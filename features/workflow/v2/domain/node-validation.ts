import { safeFieldKey, validExpression, validFieldSchema } from "../data-validation";
import { HTTP_METHODS, httpConfigurationError, type HttpNodeRequest } from "../http-types";
import { isWorkflowV2Kind, NODE_DEFINITIONS } from "./node-definitions";
import type {
  NodeConfiguration,
  WorkflowV2Kind,
  WorkflowV2Node,
  WorkflowV2NodeData,
} from "./nodes";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const pairs = (value: unknown) =>
  Array.isArray(value) &&
  value.every((item) => isRecord(item) && text(item.name) && text(item.value));

function httpRequest(value: unknown): value is HttpNodeRequest {
  return (
    isRecord(value) &&
    HTTP_METHODS.some((method) => method === value.method) &&
    text(value.url) &&
    pairs(value.query) &&
    pairs(value.headers) &&
    pairs(value.form) &&
    ["none", "json", "text", "form"].some((kind) => kind === value.bodyType) &&
    text(value.body) &&
    finite(value.timeoutSeconds) &&
    finite(value.responseLimitBytes) &&
    typeof value.failOnHttpError === "boolean"
  );
}

/** 校验配置项的运行时结构。空字符串和未填写的可选项仍是合法草稿。 */
const validators: Record<keyof NodeConfiguration, (value: unknown) => boolean> = {
  fields: validFieldSchema,
  title: text,
  modelId: text,
  systemPrompt: text,
  prompt: (value) =>
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        (text(item.text) || safeFieldKey(item.input)) &&
        (item.text === undefined || text(item.text)) &&
        (item.input === undefined || safeFieldKey(item.input)),
    ),
  maxOutputTokens: finite,
  temperature: finite,
  timeoutSeconds: finite,
  libraryId: text,
  versionId: text,
  topK: finite,
  maxContextChunks: finite,
  minScore: finite,
  retrievalMode: (value) => ["vector", "keyword", "hybrid"].includes(String(value)),
  denseCandidates: finite,
  keywordCandidates: finite,
  rerankCandidates: finite,
  minRerankScore: finite,
  neighborRadius: finite,
  exactMatch: (value) => ["prefer", "require", "off"].includes(String(value)),
  rerankModelId: text,
  rerankFailurePolicy: (value) => ["fail", "fallback"].includes(String(value)),
  cases: (value) =>
    Array.isArray(value) &&
    value.length <= 8 &&
    new Set(value.map((item) => (isRecord(item) ? item.key : null))).size === value.length &&
    value.every(
      (item) =>
        isRecord(item) &&
        safeFieldKey(item.key) &&
        !["else", "route"].includes(item.key) &&
        (item.label === undefined || text(item.label)) &&
        (item.match === "all" || item.match === "any") &&
        Array.isArray(item.conditions) &&
        item.conditions.every(
          (rule) =>
            isRecord(rule) &&
            safeFieldKey(rule.input) &&
            text(rule.operator) &&
            (rule.value === undefined ||
              text(rule.value) ||
              finite(rule.value) ||
              typeof rule.value === "boolean"),
        ),
    ),
  http: httpRequest,
  extract: (value) => isRecord(value) && Object.values(value).every(text),
  credentialId: text,
  credentialRevisionId: text,
  responseMode: (value) => value === "full" || value === "fields",
  outputFields: validFieldSchema,
  outputMode: (value) => value === "text" || value === "json",
  outputTransport: (value) => value === "prompt" || value === "json_schema",
  intents: (value) =>
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 8 &&
    new Set(value.map((item) => (isRecord(item) ? item.key : null))).size === value.length &&
    value.every(
      (item) =>
        isRecord(item) &&
        safeFieldKey(item.key) &&
        !["else", "route"].includes(item.key) &&
        text(item.label) &&
        text(item.description),
    ),
  assignments: (value) =>
    Array.isArray(value) &&
    value.length <= 16 &&
    value.every(
      (item) => isRecord(item) && safeFieldKey(item.key) && validExpression(item.expression),
    ),
  language: (value) => value === "python" || value === "javascript",
  code: (value) =>
    text(value) &&
    value.length > 0 &&
    value.length <= 32768 &&
    !value.includes("\0") &&
    new TextEncoder().encode(value).length <= 32768,
  body: (value) =>
    isRecord(value) &&
    value.schemaVersion === 1 &&
    Array.isArray(value.nodes) &&
    Array.isArray(value.edges),
  maxItems: finite,
  parallelism: finite,
  batchSize: finite,
  failurePolicy: (value) => value === "failFast" || value === "continue",
  retry: (value) =>
    isRecord(value) &&
    finite(value.maxAttempts) &&
    finite(value.backoffMs) &&
    finite(value.maxBackoffMs) &&
    Array.isArray(value.retryOn ?? []) &&
    (!Array.isArray(value.retryOn) || value.retryOn.every(text)),
};

function isNodeData<K extends WorkflowV2Kind>(
  kind: K,
  value: unknown,
): value is WorkflowV2NodeData<K> {
  if (!isRecord(value) || !validFieldSchema(value.fields)) return false;
  const allowed = NODE_DEFINITIONS[kind].configuration;
  return Object.entries(validators).every(
    ([key, validate]) =>
      value[key] === undefined ||
      ((key === "retry" || Object.hasOwn(allowed, key)) && validate(value[key])),
  );
}

function validateReferences(data: Record<string, unknown>, id: string) {
  for (const reference of [
    "libraryId",
    "versionId",
    "operationId",
    "revisionId",
    "credentialId",
    "credentialRevisionId",
    "rerankModelId",
  ]) {
    const value = data[reference];
    if (
      value !== undefined &&
      value !== "" &&
      (!text(value) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
    )
      throw new Error(`节点 ${id} 的 ${reference} 引用无效。`);
  }
}

function validateTransform(data: Record<string, unknown>, id: string) {
  const { assignments, outputFields } = data;
  if (
    !Array.isArray(assignments) ||
    !validFieldSchema(outputFields) ||
    assignments.length !== outputFields.length ||
    new Set(assignments.map((item) => item.key)).size !== assignments.length ||
    assignments.some((item) => !outputFields.some((field) => field.key === item.key))
  )
    throw new Error(`节点 ${id} 变量处理配置无效。`);
}

function hasScriptForbiddenField(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (["image", "contextChunks", "answer"].includes(String(value.type))) return true;
  return (
    (Array.isArray(value.properties) && value.properties.some(hasScriptForbiddenField)) ||
    (isRecord(value.items) && hasScriptForbiddenField(value.items))
  );
}

function validateConfiguration(kind: WorkflowV2Kind, data: Record<string, unknown>, id: string) {
  if (kind === "httpRequest" && (!isNodeData("httpRequest", data) || httpConfigurationError(data)))
    throw new Error(`节点 ${id} HTTP 配置无效。`);
  if (kind === "parameterExtract" && !validFieldSchema(data.outputFields))
    throw new Error(`节点 ${id} 需要提取字段。`);
  if (kind === "intentClassify" && !validators.intents(data.intents))
    throw new Error(`节点 ${id} 分类配置无效。`);
  if (kind === "transform") validateTransform(data, id);
  if (kind === "script") {
    if (data.language !== "python" && data.language !== "javascript")
      throw new Error(`节点 ${id} 脚本语言无效。`);
    if (!validFieldSchema(data.outputFields)) throw new Error(`节点 ${id} 需要脚本输出字段。`);
    if (!text(data.code) || data.code.length === 0 || data.code.length > 32768)
      throw new Error(`节点 ${id} 脚本代码不能为空且不能超过 32 KiB。`);
    if (
      !finite(data.timeoutSeconds) ||
      data.timeoutSeconds < 1 ||
      data.timeoutSeconds > 30 ||
      data.timeoutSeconds !== Math.trunc(data.timeoutSeconds)
    )
      throw new Error(`节点 ${id} 脚本超时必须为 1–30 秒整数。`);
    const fields = [...(data.fields as unknown[]), ...(data.outputFields as unknown[])];
    if (fields.some(hasScriptForbiddenField))
      throw new Error(`节点 ${id} 脚本字段不能使用图片或知识证据类型。`);
  }
}

function assertNode(value: unknown): asserts value is WorkflowV2Node {
  if (!isRecord(value) || !text(value.id) || !value.id.trim() || value.id.length > 100)
    throw new Error("节点 ID 缺失或过长。");
  if (!isWorkflowV2Kind(value.type)) throw new Error(`节点 ${value.id} 类型未支持。`);
  if (!isRecord(value.position) || !finite(value.position.x) || !finite(value.position.y))
    throw new Error(`节点 ${value.id} 位置无效。`);
  if (!isRecord(value.data)) throw new Error(`节点 ${value.id} 字段契约无效。`);
  validateReferences(value.data, value.id);
  if (!isNodeData(value.type, value.data)) throw new Error(`节点 ${value.id} 配置或字段契约无效。`);
  validateConfiguration(value.type, value.data, value.id);
}

/** 外部数据必须经过结构和种类校验；不把 unknown 断言为图或节点。 */
export function parseWorkflowNode(value: unknown): WorkflowV2Node {
  assertNode(value);
  return value;
}
