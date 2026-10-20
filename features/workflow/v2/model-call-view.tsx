"use client";

import type { WorkflowNodeRun, WorkflowModelCall } from "../types";
import { usesModel } from "./types";

/** 显示实际收据，不将复用、跳过、无证据短路或历史无记录误标为新模型调用。 */
export function ModelCallView({
  node,
  active = false,
}: {
  node: WorkflowNodeRun;
  active?: boolean;
}) {
  const call = node.output?.modelCall;
  if (!call)
    return usesModel(String(node.nodeType)) ? (
      <p className="text-[11px] text-muted-foreground">
        {node.status === "queued" || node.status === "skipped"
          ? "未调用模型"
          : "此节点没有模型调用收据（可能为无证据短路或旧版运行）。"}
      </p>
    ) : null;
  return <CallReceipt node={node} call={call} active={active} />;
}
function receiptStatus(call: WorkflowModelCall, active: boolean) {
  return call.finishReason === "length"
    ? "输出被截断（length）"
    : call.status === "requesting"
      ? active
        ? "请求中"
        : "待核对：请求后未确认结果"
      : call.status === "completed"
        ? "已收到模型响应"
        : call.status === "failed"
          ? "上游明确失败"
          : "调用状态待核对";
}
function CallReceipt({
  node,
  call,
  active,
}: {
  node: WorkflowNodeRun;
  call: WorkflowModelCall;
  active: boolean;
}) {
  const truncated = call.finishReason === "length";
  const status = receiptStatus(call, active);
  const row = (label: string, value: string | number | null | undefined) => (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2" key={label}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all">{value ?? "未知"}</dd>
    </div>
  );
  return (
    <section
      aria-label="模型调用记录"
      className="space-y-2 rounded-lg border bg-muted/20 p-3 text-[11px]"
    >
      <h4 className="font-semibold">
        模型调用记录{" "}
        {node.isReused && <span className="text-blue-600">· 历史收据，本次未再次调用</span>}
      </h4>
      <p
        className={
          truncated || call.status === "unknown" || (call.status === "requesting" && !active)
            ? "text-amber-700"
            : "text-primary"
        }
      >
        {status}
      </p>
      {truncated && (
        <p className="leading-5 text-amber-700">
          请提高节点的最大输出
          token，或缩短输入。思考模型的推理也可能占用输出预算；本次结果可能没有回答正文或不完整，系统不会自动重试。
        </p>
      )}
      <dl className="space-y-1.5">
        {row("服务商", call.providerName)}
        {row("模型", `${call.modelName} · ${call.modelKey}`)}
        {row("协议 / 格式", `${call.protocol} / ${call.transport ?? call.outputMode}`)}
        {call.outputMode === "rerank" && row("重排候选", call.candidateCount)}
        {row(
          "耗时",
          call.durationMs === undefined ? undefined : `${(call.durationMs / 1000).toFixed(2)} 秒`,
        )}
        {row("输入 token", call.usage?.prompt_tokens)}
        {row("输出 token", call.usage?.completion_tokens)}
        {row("总 token", call.usage?.total_tokens)}
        {row("开始时间", new Date(call.startedAt).toLocaleString())}
        {row("HTTP 状态", call.httpStatus)}
        {row("结束原因", call.finishReason)}
      </dl>
      {call.error && (
        <p role="alert" className="text-amber-700">
          {call.error}
        </p>
      )}
      <details>
        <summary className="cursor-pointer text-muted-foreground">请求标识与参数</summary>
        <dl className="mt-2 space-y-1.5">
          {row("调用 ID", call.id)}
          {row("上游请求 ID", call.upstreamRequestId)}
          {row("模型配置 ID", call.modelId)}
          {row("最大输出", call.maxOutputTokens)}
          {row("温度", call.temperature)}
        </dl>
      </details>
      <p className="leading-5 text-muted-foreground">
        用量只采用上游实际返回值，不代表计费账单。收到响应不代表结构化校验或后续节点成功。
      </p>
    </section>
  );
}
