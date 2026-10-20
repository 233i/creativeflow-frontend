"use client";

import { useState } from "react";
import {
  Bot,
  Clock3,
  ListOrdered,
  RefreshCw,
  RotateCcw,
  SquareArrowOutUpRight,
} from "lucide-react";
import type { WorkflowRun } from "../types";
import { cn } from "@/lib/utils";
import { V2OutputView } from "./output-view";
import { V2RunNodes } from "./run-nodes";
import { elapsedSeconds, formatDuration, runSummary, V2_RUN_LABELS } from "./run-presentation";
import { V2RunStatus } from "./run-status";
import { V2OverallProgress } from "./run-progress";
import type { WorkflowV2Graph } from "./types";
import { V2ModelCalls } from "./model-calls";

const tabs = ["steps", "calls", "output"] as const;

/** 详情只消费现有已鉴权运行；查询与续跑保持明确分离。 */
export function V2RunPanel({
  run,
  graph,
  now,
  busy,
  onRefresh,
  onResume,
  onLocate,
  onRetryNode,
  onSkipNode,
  onRollback,
}: {
  run: WorkflowRun;
  graph: WorkflowV2Graph;
  now: number;
  busy: boolean;
  onRefresh: () => void;
  onResume: () => void;
  onLocate: (id: string) => void;
  onRetryNode?: (id: string) => void;
  onSkipNode?: (id: string) => void;
  onRollback?: (id: string) => void;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("steps");
  const summary = runSummary(run);
  const outputs = run.nodes.filter(
    (node) =>
      (run.debugNodeId ? node.nodeId === run.debugNodeId : String(node.nodeType) === "end") &&
      node.status === "succeeded" &&
      node.output?.fields,
  );
  return (
    <section aria-label="运行详情内容" className="p-4">
      {run.debugNodeId && (
        <p className="mb-3 rounded-lg bg-primary/5 p-2 text-xs">
          单节点调试 · {run.debugNodeId} · 仅此节点执行，不代表整条工作流已通过。
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{V2_RUN_LABELS[run.status]}</h2>
        <V2RunStatus status={run.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Clock3 className="size-3.5" aria-hidden />
          {formatDuration(
            elapsedSeconds(
              run.createdAt,
              summary.active ? null : (run.finishedAt ?? run.updatedAt),
              now,
            ),
          )}
        </span>
        <span>
          完成 {summary.completed} / {summary.total}
          {summary.skipped > 0 && ` · 跳过 ${summary.skipped}`}
        </span>
      </div>
      <V2OverallProgress value={summary.progress} failed={run.status === "failed"} />
      <p className="mt-3 break-all font-mono text-[10px] text-muted-foreground">任务 {run.id}</p>
      <RunRecoveryActions
        run={run}
        busy={busy}
        onRefresh={onRefresh}
        onResume={onResume}
        onRollback={onRollback}
      />
      <p className="mt-3 rounded-lg bg-muted/60 p-2.5 text-[11px] leading-5 text-muted-foreground">
        结果来自提交时的快照。关闭面板或页面不会停止任务；重新查询不会重新生成。状态不明的模型或外部请求不会自动重发。
      </p>
      {run.error && (
        <p
          role="alert"
          className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-destructive/5 p-3 text-xs leading-5 text-destructive"
        >
          {run.error}
        </p>
      )}
      <div role="tablist" aria-label="执行详情视图" className="mt-5 flex gap-4 border-b">
        {tabs.map((value) => {
          const Icon =
            value === "steps" ? ListOrdered : value === "calls" ? Bot : SquareArrowOutUpRight;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              id={`v2-run-${value}-tab`}
              aria-controls={`v2-run-${value}`}
              aria-selected={tab === value}
              tabIndex={tab === value ? 0 : -1}
              onClick={() => setTab(value)}
              onKeyDown={(event) => {
                if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? "steps"
                      : event.key === "End"
                        ? "output"
                        : tabs[
                            (tabs.indexOf(tab) +
                              (event.key === "ArrowRight" ? 1 : tabs.length - 1)) %
                              tabs.length
                          ];
                  setTab(next);
                  document.getElementById(`v2-run-${next}-tab`)?.focus();
                }
              }}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 py-2.5 text-xs",
                tab === value
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-muted-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {value === "steps" ? "执行过程" : value === "calls" ? "模型调用" : "最终输出"}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`v2-run-${tab}`}
        aria-labelledby={`v2-run-${tab}-tab`}
        tabIndex={0}
        className="pt-4 outline-none"
      >
        {tab === "steps" ? (
          <V2RunNodes
            run={run}
            graph={graph}
            now={now}
            onLocate={onLocate}
            onRetryNode={onRetryNode}
            onSkipNode={onSkipNode}
          />
        ) : tab === "calls" ? (
          <V2ModelCalls run={run} graph={graph} onLocate={onLocate} />
        ) : outputs.length ? (
          <div aria-label="最终输出" className="space-y-3">
            {outputs.map((node) => (
              <V2OutputView key={node.nodeId} fields={node.output!.fields!} />
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-xs leading-6 text-muted-foreground">
            {summary.active
              ? "任务执行中，结束节点完成后将在这里显示结果。"
              : "没有最终输出，可在执行过程中查看已完成步骤。"}
          </p>
        )}
      </div>
    </section>
  );
}

function RunRecoveryActions({
  run,
  busy,
  onRefresh,
  onResume,
  onRollback,
}: {
  run: WorkflowRun;
  busy: boolean;
  onRefresh: () => void;
  onResume: () => void;
  onRollback?: (id: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={onRefresh}
        className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
      >
        <RefreshCw className="size-3" aria-hidden />
        重新查询
      </button>
      {run.status === "failed" && !run.debugNodeId && (
        <button
          type="button"
          disabled={busy}
          onClick={onResume}
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
        >
          <RotateCcw className="size-3" aria-hidden />
          继续未执行节点
        </button>
      )}
      {run.status === "failed" &&
        !run.debugNodeId &&
        onRollback &&
        run.nodes.some((node) => node.status === "failed") && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onRollback(run.nodes.find((node) => node.status === "failed")!.nodeId)}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
          >
            <RotateCcw className="size-3" aria-hidden /> 从失败节点回滚重跑
          </button>
        )}
    </div>
  );
}
