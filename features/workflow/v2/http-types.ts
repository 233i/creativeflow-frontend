import type { WorkflowField } from "./domain/fields";
import type { WorkflowV2NodeData } from "./domain/nodes";

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
export interface HttpPair {
  name: string;
  value: string;
}
export interface HttpNodeRequest {
  method: (typeof HTTP_METHODS)[number];
  url: string;
  query: HttpPair[];
  headers: HttpPair[];
  bodyType: "none" | "json" | "text" | "form";
  body: string;
  form: HttpPair[];
  timeoutSeconds: number;
  responseLimitBytes: number;
  failOnHttpError: boolean;
}
export const HTTP_RESPONSE_LIMIT = 1024 * 1024;
export const defaultHttpRequest = (): HttpNodeRequest => ({
  method: "GET",
  url: "",
  query: [],
  headers: [],
  bodyType: "none",
  body: "",
  form: [],
  timeoutSeconds: 30,
  responseLimitBytes: HTTP_RESPONSE_LIMIT,
  failOnHttpError: true,
});

export function httpOutputFields(data: WorkflowV2NodeData<"httpRequest">): WorkflowField[] {
  if (data.responseMode === "fields") return data.outputFields ?? [];
  return [
    { key: "statusCode", label: "HTTP 状态码", type: "number", required: true },
    {
      key: "body",
      label: "响应正文",
      type: "string",
      required: true,
      maxLength: HTTP_RESPONSE_LIMIT,
    },
    { key: "headers", label: "响应头", type: "object", required: true },
    ...(data.outputFields ?? []),
  ];
}

/** 导入与编辑使用同一基础结构校验，服务端仍负责变量、权限和网络校验。 */
export function httpConfigurationError(
  data: WorkflowV2NodeData<"httpRequest">,
  executing = false,
): string | null {
  const http = data.http;
  if (
    !http ||
    !HTTP_METHODS.includes(http.method) ||
    !["none", "json", "text", "form"].includes(http.bodyType)
  )
    return "HTTP 请求配置或方法无效。";
  if (typeof http.url !== "string" || http.url.length > 4096 || (executing && !http.url.trim()))
    return "请填写 HTTP URL。";
  if (http.url) {
    try {
      const parsed = new URL(http.url.replace(/\{\{\s*[A-Za-z][A-Za-z0-9_]*\s*\}\}/g, "value"));
      const authority = http.url.split("://")[1]?.split(/[/?#]/)[0] ?? "";
      if (
        !["https:", "http:"].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password ||
        parsed.hash ||
        /[{}]/.test(authority) ||
        http.url.includes("\\")
      )
        return "URL 变量只能用于路径和查询参数，不能改变目标站点。";
    } catch {
      return "URL 格式无效，请填写完整 HTTP(S) 地址。";
    }
  }
  if (["GET", "HEAD"].includes(http.method) && http.bodyType !== "none")
    return "GET 和 HEAD 不携带请求体。";
  if (
    !Number.isInteger(http.timeoutSeconds) ||
    http.timeoutSeconds < 1 ||
    http.timeoutSeconds > 120
  )
    return "超时应为 1–120 秒。";
  if (
    !Number.isInteger(http.responseLimitBytes) ||
    http.responseLimitBytes < 1024 ||
    http.responseLimitBytes > HTTP_RESPONSE_LIMIT
  )
    return "响应上限应为 1024–1048576 字节（1 MiB）。";
  if (
    typeof http.failOnHttpError !== "boolean" ||
    typeof http.body !== "string" ||
    http.body.length > HTTP_RESPONSE_LIMIT
  )
    return "请求体或响应处理配置无效。";
  if (data.responseMode !== undefined && !["full", "fields"].includes(data.responseMode))
    return "响应模式无效。";
  for (const pairs of [http.query, http.headers, http.form])
    if (
      !Array.isArray(pairs) ||
      pairs.length > 24 ||
      pairs.some((pair) => !pair || typeof pair.name !== "string" || typeof pair.value !== "string")
    )
      return "请求参数结构无效。";
  const variables = new Set(data.fields.map((field) => field.key));
  const validTemplate = (value: string) => {
    const pattern = /\{\{\{\{|\}\}\}\}|\{\{\s*([A-Za-z][A-Za-z0-9_]{0,47})\s*\}\}/g;
    return (
      [...value.matchAll(pattern)].every((match) => !match[1] || variables.has(match[1])) &&
      !/\{\{|\}\}/.test(value.replace(pattern, ""))
    );
  };
  if (
    [
      http.url,
      http.body,
      ...http.query.map((pair) => pair.value),
      ...http.headers.map((pair) => pair.value),
      ...http.form.map((pair) => pair.value),
    ].some((value) => !validTemplate(value))
  )
    return "请求模板引用了不存在的输入变量或不完整的 {{变量}}。";
  for (const [index, pairs] of [http.query, http.headers, http.form].entries()) {
    const names = pairs.map((pair) => (index === 1 ? pair.name.toLowerCase() : pair.name));
    if (
      new Set(names).size !== names.length ||
      pairs.some(
        (pair) => !pair.name || pair.name.length > 128 || pair.value.length > HTTP_RESPONSE_LIMIT,
      )
    )
      return "参数名称不能为空、重复或超过长度限制。";
  }
  if (http.headers.some((pair) => /authorization|api-key|apikey|token|secret/i.test(pair.name)))
    return "认证请求头请使用鉴权凭据。";
  if (http.bodyType === "json" && (executing || http.body)) {
    try {
      JSON.parse(http.body);
    } catch {
      return 'JSON 格式无效，变量需写在字符串中，例如 {"query":"{{question}}"}。';
    }
  }
  if (
    !Array.isArray(data.outputFields) ||
    data.outputFields.length > (data.responseMode === "fields" ? 16 : 13) ||
    !data.extract ||
    typeof data.extract !== "object" ||
    Array.isArray(data.extract) ||
    (data.responseMode === "fields" && !data.outputFields.length)
  )
    return "响应提取配置无效。";
  const names = httpOutputFields(data).map((field) => field.key);
  if (new Set(names).size !== names.length)
    return "提取字段不能重复或使用 statusCode、body、headers。";
  if (
    data.outputFields.some(
      (field) => !["string", "number", "boolean", "object", "array"].includes(field.type),
    )
  )
    return "HTTP 提取字段只支持普通 JSON 类型。";
  if (
    Object.keys(data.extract).length !== data.outputFields.length ||
    data.outputFields.some(
      (field) =>
        typeof data.extract?.[field.key] !== "string" ||
        !/^(?:\/.*)?$/.test(data.extract[field.key]) ||
        /~(?![01])/.test(data.extract[field.key]),
    )
  )
    return "每个提取字段需要有效的 JSON Pointer 路径。";
  return null;
}
