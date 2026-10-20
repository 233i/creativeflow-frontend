"use client";

import { Activity, ArrowUpRight, Clock3 } from "lucide-react";
import type { WorkflowRun } from "../types";
import { cn } from "@/lib/utils";
import {
  elapsedSeconds,
  formatDuration,
  nodeRunLabel,
  runSummary,
  V2_RUN_LABELS,
} from "./run-presentation";
import { V2RunStatus } from "./run-status";
import type { WorkflowV2Graph } from "./types";

/** 画布保留轻量实时进度，完整时间线与输出在右侧查看。 */
export function V2RunProgress({
  run,
  graph,
  now,
  onOpen,
}: {
  run: WorkflowRun;
  graph: WorkflowV2Graph;
  now: number;
  onOpen: () => void;
}) {
  const summary = runSummary(run);
  const elapsed = elapsedSeconds(
    run.createdAt,
    summary.active ? null : (run.finishedAt ?? run.updatedAt),
    now,
  );
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="查看执行详情"
      className="canvas-panel absolute top-3 right-3 z-20 w-[min(18rem,calc(100%-5.5rem))] rounded-xl border p-3 text-left shadow-node transition-shadow hover:shadow-panel sm:top-4 sm:right-4"
    >
      <span className="flex items-center gap-2">
        <Activity className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 text-xs font-semibold" role="status">
          {run.debugNodeId ? "单节点调试 · " : ""}
          {V2_RUN_LABELS[run.status]}
        </span>
        <span className="flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground">
          <Clock3 className="size-3" aria-hidden />
          {formatDuration(elapsed)}
        </span>
        <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden />
      </span>
      <span
        className="mt-2 block truncate text-xs"
        title={summary.current ? nodeRunLabel(summary.current, graph) : undefined}
      >
        {summary.current
          ? `正在执行 · ${nodeRunLabel(summary.current, graph)}`
          : run.status === "queued"
            ? "等待调度，任务已保存"
            : run.status === "running"
              ? "正在调度下一步"
              : run.status === "failed"
                ? "查看失败步骤与错误原因"
                : run.status === "cancelled"
                  ? "运行已停止，可查看已完成步骤"
                  : "全部步骤已结束，查看输出"}
      </span>
      <V2OverallProgress value={summary.progress} failed={run.status === "failed"} />
      <span className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10px] text-muted-foreground">
        <span>
          已结束 {summary.settled} / {summary.total} 个节点
        </span>
        {summary.current ? (
          <V2RunStatus status="running" />
        ) : (
          <span>
            完成 {summary.completed}
            {summary.skipped > 0 && ` · 跳过 ${summary.skipped}`}
          </span>
        )}
      </span>
    </button>
  );
}

export function V2OverallProgress({ value, failed = false }: { value: number; failed?: boolean }) {
  return (
    <div
      role="progressbar"
      aria-label="节点处理进度"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none",
          failed ? "bg-destructive" : "bg-primary",
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
