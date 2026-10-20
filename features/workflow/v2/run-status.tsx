import {
  CheckCircle2,
  Clock3,
  Loader2,
  MinusCircle,
  RotateCcw,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowNodeRunStatus } from "../types";
import { V2_NODE_STATUS_LABELS } from "./run-presentation";

const STATUS_ICONS: Record<WorkflowNodeRunStatus, LucideIcon> = {
  queued: Clock3,
  running: Loader2,
  retrying: Loader2,
  succeeded: CheckCircle2,
  failed: XCircle,
  cancelled: XCircle,
  skipped: MinusCircle,
};

const STATUS_COLORS: Partial<Record<WorkflowNodeRunStatus, string>> = {
  running: "text-primary",
  retrying: "text-primary",
  failed: "text-destructive",
  succeeded: "text-emerald-600 dark:text-emerald-400",
};

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
  const active = status === "running" || status === "retrying";
  const Icon = reuse ? RotateCcw : (STATUS_ICONS[status] ?? Clock3);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[10px] font-medium",
        reuse
          ? "text-blue-600 dark:text-blue-400"
          : (STATUS_COLORS[status] ?? "text-muted-foreground"),
      )}
    >
      <Icon
        className={cn("size-3.5", active && "animate-spin motion-reduce:animate-none")}
        aria-hidden
      />
      {reuse ? "已复用" : V2_NODE_STATUS_LABELS[status]}
      {active && progress != null ? ` ${progress}%` : ""}
    </span>
  );
}
