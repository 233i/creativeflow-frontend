import type { PublicationField } from "./contracts";

/** 使用发布契约的默认值和取值范围构造调用示例。 */
export function buildWorkflowCurl(
  workflowId: string,
  bindings: readonly PublicationField[],
  stream = false,
): string {
  const inputs = Object.fromEntries(bindings.map((input) => [input.key, exampleValue(input)]));
  const body = JSON.stringify({ inputs, ...(stream ? { stream: true } : {}) }, null, 2).replaceAll(
    "'",
    "'\\''",
  );
  return [
    `curl -X POST "https://your-domain/api/external/v1/workflows/${workflowId}/runs" \\`,
    '  -H "Authorization: Bearer cf_live_xxx" \\',
    '  -H "Idempotency-Key: business-order-10001" \\',
    '  -H "Content-Type: application/json" \\',
    `  -d '${body}'`,
  ].join("\n");
}

function exampleValue(input: PublicationField): unknown {
  if (input.default !== undefined && (input.default !== null || input.nullable))
    return input.default;
  if (input.enum?.length) return input.enum[0];
  if (input.type === "image") return { assetId: "先调用图片上传接口获得的 assetId" };
  if (input.type === "integer" || input.type === "number") {
    const minimum = input.minimum ?? input.constraints?.minimum ?? -Infinity;
    const maximum = input.maximum ?? input.constraints?.maximum ?? Infinity;
    const integer = input.type === "integer" || input.integer;
    return Math.min(
      integer ? Math.floor(maximum) : maximum,
      Math.max(integer ? Math.ceil(minimum) : minimum, 1),
    );
  }
  if (input.type === "boolean") return false;
  if (input.type === "object")
    return Object.fromEntries(
      (input.properties ?? []).map((field) => [field.key, exampleValue(field)]),
    );
  if (input.type === "array")
    return Array.from({ length: Math.min(input.minItems ?? 0, input.maxItems ?? 100) }, () =>
      input.items ? exampleValue(input.items) : null,
    );
  if (input.type === "enum") return input.constraints?.values?.[0] ?? "option";
  return "请填写文本".slice(0, input.maxLength ?? input.constraints?.maxLength);
}

/** 生成期间只查询同一任务，不再次提交生成。 */
export function buildWorkflowPollCurl(): string {
  return [
    'curl "https://your-domain/api/external/v1/runs/替换为返回的runId" \\',
    '  -H "Authorization: Bearer cf_live_xxx"',
  ].join("\n");
}

/** 订阅既有运行；-N 关闭 curl 缓冲，Last-Event-ID 只在断线续读时添加。 */
export function buildWorkflowStreamCurl(): string {
  return [
    'curl -N "https://your-domain/api/external/v1/runs/替换为返回的runId/events" \\',
    '  -H "Authorization: Bearer cf_live_xxx" \\',
    '  -H "Accept: text/event-stream"',
    "",
    "# 断线后向同一个 eventsUrl 重连，额外带上最后一个 output.delta 事件的 id：",
    '# -H "Last-Event-ID: 返回的runId:事件序号"',
  ].join("\n");
}

/** AG-UI 使用相同已发布契约，客户端 runId 不等于服务端持久化运行 ID。 */
export function buildWorkflowAgUiCurl(
  workflowId: string,
  bindings: readonly PublicationField[],
): string {
  const body = JSON.stringify(
    {
      threadId: "customer-10001",
      runId: "turn-10001",
      messages: [],
      tools: [],
      context: [],
      state: {},
      forwardedProps: {
        inputs: Object.fromEntries(bindings.map((input) => [input.key, exampleValue(input)])),
      },
    },
    null,
    2,
  ).replaceAll("'", "'\\''");
  return [
    `curl -N -X POST "https://your-domain/api/agui/v1/workflows/${workflowId}/runs" \\`,
    '  -H "Authorization: Bearer cf_live_xxx" \\',
    '  -H "Accept: text/event-stream" \\',
    '  -H "Content-Type: application/json" \\',
    `  -d '${body}'`,
  ].join("\n");
}

/** 续读原任务而非再提交生成；游标必须原样使用。 */
export function buildWorkflowAgUiResumeCurl(): string {
  return [
    'curl -N "https://your-domain/api/agui/v1/runs/替换为internalRunId/events" \\',
    '  -H "Authorization: Bearer cf_live_xxx" \\',
    '  -H "Last-Event-ID: 原样填写最后收到的SSE事件id"',
  ].join("\n");
}
