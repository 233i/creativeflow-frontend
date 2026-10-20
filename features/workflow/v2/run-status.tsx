import { CheckCircle2, Clock3, Loader2, MinusCircle, RotateCcw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowNodeRunStatus } from "../types";
import { V2_NODE_STATUS_LABELS } from "./run-presentation";

/** 图标与文字同时标明状态，复用不会掩盖失败或取消。 */
export function V2RunStatus({
  status,
  reused = false,
  progress,
}: {
  status: WorkflowNodeRunStatus;
  reused?: boolean;
  progress?: number | null;
}) {
  const reuse = status === "succeeded" && reused;
  const Icon = reuse
    ? RotateCcw
      : status === "running" || status === "retrying"
      ? Loader2
      : status === "succeeded"
        ? CheckCircle2
        : status === "failed" || status === "cancelled"
          ? XCircle
          : status === "skipped"
            ? MinusCircle
            : Clock3;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[10px] font-medium",
        status === "running" || status === "retrying"
          ? "text-primary"
          : status === "failed"
            ? "text-destructive"
            : reuse
              ? "text-blue-600 dark:text-blue-400"
              : status === "succeeded"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-3.5",
          (status === "running" || status === "retrying") && "animate-spin motion-reduce:animate-none",
        )}
        aria-hidden
      />
      {reuse ? "已复用" : V2_NODE_STATUS_LABELS[status]}
      {(status === "running" || status === "retrying") && progress != null ? ` ${progress}%` : ""}
    </span>
  );
}
