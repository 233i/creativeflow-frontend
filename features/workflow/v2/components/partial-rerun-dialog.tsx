"use client";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReadonlyWorkflowGraph } from "../../readonly-graph";
import { actionClass } from "../config-styles";
import type { WorkflowActions } from "../controllers/use-workflow-actions";
export function V2PartialRerunDialog({
  value,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  value: WorkflowActions["partial"];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const partial = value?.preview ?? null;
  const partialGraph = value?.graph;
  const run = value?.run;
  return (
    <Dialog
      isOpen={partial !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"
    >
      <DialogHeader>
        <DialogTitle>确认局部重跑</DialogTitle>
        <DialogDescription>
          使用成功运行的原始图、输入与模型快照；当前未提交的编辑不参与。仅复用范围外的成功输出。
        </DialogDescription>
      </DialogHeader>
      {partial && (
        <div className="space-y-3 text-xs">
          <p>
            重新执行 {partial.rerunNodeIds.length} 个节点，复用 {partial.reusedNodeIds.length}{" "}
            个节点。
          </p>
          {partialGraph && (
            <div className="h-80 overflow-hidden rounded-lg border">
              <ReadonlyWorkflowGraph graph={partialGraph} run={run} preview={partial} />
            </div>
          )}
          <details>
            <summary>查看影响节点清单</summary>
            <ul className="space-y-1">
              {run?.nodes.map((node) => (
                <li key={node.nodeId} className="break-all">
                  {partial.rerunNodeIds.includes(node.nodeId) ? "↻ 重跑" : "✓ 复用"} ·{" "}
                  {String(node.nodeType)} · {node.nodeId}
                </li>
              ))}
            </ul>
          </details>
          {run?.nodes.some(
            (node) =>
              partial.rerunNodeIds.includes(node.nodeId) &&
              [
                "llm",
                "knowledgeRetrieve",
                "knowledgeAnswer",
                "parameterExtract",
                "intentClassify",
              ].includes(String(node.nodeType)),
          ) && (
            <p className="rounded-lg bg-amber-500/10 p-3 text-amber-700">
              此次会再次调用选中范围内的模型，可能产生费用。范围外已成功的检索将复用，不再次向量化。
            </p>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <button className={actionClass} disabled={busy} onClick={onConfirm}>
            确认重跑
          </button>
        </div>
      )}
    </Dialog>
  );
}
