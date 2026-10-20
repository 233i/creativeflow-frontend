"use client";

import type { WorkflowRun } from "../types";
import { usesModel, type WorkflowV2Graph } from "./types";
import { nodeRunLabel } from "./run-presentation";
import { ModelCallView } from "./model-call-view";

/** 单独汇总本次真实调用；旧收据、未执行与无证据短路不虚增次数或 token。 */
export function V2ModelCalls({
  run,
  graph,
  onLocate,
}: {
  run: WorkflowRun;
  graph: WorkflowV2Graph;
  onLocate: (id: string) => void;
}) {
  const nodes = run.nodes.filter(
    (node) => usesModel(String(node.nodeType)) || node.output?.modelCall,
  );
  const calls = [
    ...new Map(
      nodes
        .filter((node) => !node.isReused && node.output?.modelCall)
        .map((node) => [node.output!.modelCall!.id, node.output!.modelCall!]),
    ).values(),
  ];
  const missing = nodes.filter(
    (node) =>
      !node.isReused && !node.output?.modelCall && !["queued", "skipped"].includes(node.status),
  ).length;
  const knownUsage = calls.filter((call) => typeof call.usage?.total_tokens === "number");
  const sum = knownUsage.reduce((total, call) => total + call.usage!.total_tokens!, 0);
  return (
    <div className="space-y-3" aria-label="本次模型调用汇总">
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-3 text-xs">
        <p>
          已记录本次调用 <strong>{calls.length}</strong> 次
        </p>
        <p>
          复用历史{" "}
          <strong>{nodes.filter((node) => node.isReused && node.output?.modelCall).length}</strong>{" "}
          次
        </p>
        <p className="col-span-2">
          上游总 token：
          {missing || knownUsage.length < calls.length
            ? `未完整报告（已报告 ${sum}）`
            : calls.length
              ? sum
              : "无本次用量记录"}
        </p>
      </div>
      {missing > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {missing} 个节点未保存调用收据，可能为旧版记录或无证据短路；不能据此推断为零费用。
        </p>
      )}
      {!nodes.length && (
        <p className="py-6 text-center text-xs text-muted-foreground">本次执行不包含模型节点。</p>
      )}
      {nodes.map((node) => (
        <article key={node.nodeId} className="space-y-2">
          <div className="flex items-start justify-between gap-2 text-xs">
            <h3 className="min-w-0 break-words font-medium">{nodeRunLabel(node, graph)}</h3>
            <button
              type="button"
              className="shrink-0 text-primary underline"
              onClick={() => onLocate(node.nodeId)}
            >
              定位节点
            </button>
          </div>
          <ModelCallView
            node={node}
            active={run.status === "running" && node.status === "running"}
          />
        </article>
      ))}
    </div>
  );
}
