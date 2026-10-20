"use client";

import type { WorkflowNodeRun, WorkflowRun } from "../types";
import { V2OutputView } from "./output-view";
import type { WorkflowV2Graph } from "./types";
import { elapsedSeconds, formatDuration, nodeRunLabel, reportedProgress } from "./run-presentation";
import { V2RunStatus } from "./run-status";
import { cn } from "@/lib/utils";
import { ChevronRight, LocateFixed, RotateCcw, SkipForward } from "lucide-react";
import { ModelCallView } from "./model-call-view";

/** 展示鉴权后的节点持久状态；不把 skipped 当成功，也不把原结果当作重新生成。 */
export function V2RunNodes({
  run,
  onLocate,
  graph,
  now = Date.parse(run.updatedAt),
  onRetryNode,
  onSkipNode,
}: {
  run: WorkflowRun;
  onLocate?: (id: string) => void;
  graph?: WorkflowV2Graph;
  now?: number;
  onRetryNode?: (nodeId: string) => void;
  onSkipNode?: (nodeId: string) => void;
}) {
  return (
    <ol className="space-y-2" aria-label="运行节点明细">
      {run.nodes.map((node, index) => (
        <li
          key={`${run.id}:${node.nodeId}`}
          aria-current={
            node.status === "running" || node.status === "retrying" ? "step" : undefined
          }
        >
          <details
            className={cn(
              "group/step rounded-xl border text-xs",
              (node.status === "running" || node.status === "retrying") &&
                "border-primary/40 bg-primary/5 ring-1 ring-primary/10",
              node.status === "failed" && "border-destructive/40 bg-destructive/5",
              node.status === "skipped" && "border-dashed text-muted-foreground",
            )}
          >
            <RunNodeSummary node={node} index={index} run={run} graph={graph} now={now} />
            <div className="space-y-3 border-t border-border/60 p-3">
              <p className="break-all font-mono text-[10px] text-muted-foreground">{node.nodeId}</p>
              {onLocate && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                  onClick={() => onLocate(node.nodeId)}
                >
                  <LocateFixed className="size-3.5" aria-hidden />
                  在画布中定位
                </button>
              )}
              <RunNodeProgress node={node} />
              <RunNodeRecoveryActions
                node={node}
                onRetryNode={onRetryNode}
                onSkipNode={onSkipNode}
              />
              {node.isReused && node.status === "succeeded" && (
                <p className="text-blue-600 dark:text-blue-400">
                  复用已确认的结果，没有再次执行此节点。
                </p>
              )}
              {node.error && (
                <p className="whitespace-pre-wrap break-words leading-5 text-destructive">
                  {node.error}
                </p>
              )}
              <ModelCallView
                node={node}
                active={run.status === "running" && node.status === "running"}
              />
              {node.output?.fields && <V2OutputView fields={node.output.fields} />}
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}

function RunNodeSummary({
  node,
  index,
  run,
  graph,
  now,
}: {
  node: WorkflowNodeRun;
  index: number;
  run: WorkflowRun;
  graph?: WorkflowV2Graph;
  now: number;
}) {
  return (
    <summary className="flex cursor-pointer list-none items-start gap-2 p-3 [&::-webkit-details-marker]:hidden">
      <span
        className={cn(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] tabular-nums",
          (node.status === "running" || node.status === "retrying") &&
            "bg-primary text-primary-foreground",
        )}
      >
        {index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words font-medium">{nodeRunLabel(node, graph)}</span>
        <span className="mt-1 block text-[10px] text-muted-foreground">
          {node.startedAt
            ? formatDuration(
                elapsedSeconds(
                  node.startedAt,
                  node.finishedAt ??
                    (run.status === "running" ? null : (run.finishedAt ?? run.updatedAt)),
                  now,
                ),
              )
            : "未开始"}
        </span>
      </span>
      <V2RunStatus
        status={node.status}
        reused={node.isReused}
        progress={reportedProgress(node.progress)}
      />
      <ChevronRight
        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-open/step:rotate-90 motion-reduce:transition-none"
        aria-hidden
      />
    </summary>
  );
}

function RunNodeProgress({ node }: { node: WorkflowNodeRun }) {
  return (
    <>
      {node.status === "skipped" && (
        <p className="leading-5">
          此节点没有执行或交付输出。请结合分支结果及运行终态判断是未命中、取消还是前序失败。
        </p>
      )}
      {node.status === "queued" && (
        <p className="text-muted-foreground">等待调度或前序节点完成。</p>
      )}
      {node.status === "retrying" && (
        <p className="text-muted-foreground">
          等待自动重试
          {node.retryAt ? `（${new Date(node.retryAt).toLocaleTimeString()}）` : ""}。
        </p>
      )}
      {node.attempt && node.maxAttempts && node.maxAttempts > 1 && (
        <p className="text-muted-foreground">
          尝试 {node.attempt} / {node.maxAttempts}
        </p>
      )}
    </>
  );
}

function RunNodeRecoveryActions({
  node,
  onRetryNode,
  onSkipNode,
}: {
  node: WorkflowNodeRun;
  onRetryNode?: (id: string) => void;
  onSkipNode?: (id: string) => void;
}) {
  return (
    <>
      {(node.status === "failed" || node.status === "queued") && onRetryNode && (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs hover:bg-muted"
          onClick={() => onRetryNode(node.nodeId)}
        >
          <RotateCcw className="size-3" aria-hidden /> 从此节点重试
        </button>
      )}
      {(node.status === "failed" || node.status === "queued" || node.status === "retrying") &&
        onSkipNode && (
          <button
            type="button"
            className="ml-2 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs hover:bg-muted"
            onClick={() => onSkipNode(node.nodeId)}
          >
            <SkipForward className="size-3" aria-hidden /> 跳过节点
          </button>
        )}
    </>
  );
}
