"use client";

import { Handle, Position } from "@xyflow/react";
import {
  CheckCircle2,
  Clock3,
  Loader2,
  LockKeyhole,
  MinusCircle,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useT } from "@/components/providers/i18n-provider";
import { NodeFeedback } from "@/components/ui/node-feedback";
import type { WorkflowPortType } from "@/features/workflow/types";
import {
  usePartialRerunNodeVisualState,
  type PartialRerunNodeVisualState,
} from "@/features/workflow/partial-rerun-preview";
import { useWorkflowStore } from "@/features/workflow/store";
import { cn } from "@/lib/utils";
import { createContext, useContext } from "react";

/** 同一参数组件在右侧检查面板中不创建画布端口，所有写入仍走原节点 store。 */
export const MediaNodeInspectorContext = createContext(false);

interface Port {
  id: string;
  label: string;
  type: WorkflowPortType;
}

const portColour: Record<WorkflowPortType, string> = {
  text: "!bg-violet-500",
  image: "!bg-cyan-500",
  video: "!bg-rose-500",
};

export function WorkflowNodeShell({
  nodeId,
  title,
  icon,
  selected,
  inputs = [],
  outputs = [],
  bodyClassName,
  children,
}: {
  nodeId: string;
  title: string;
  icon: React.ReactNode;
  selected?: boolean;
  inputs?: Port[];
  outputs?: Port[];
  /** 端口区域留白放在滚动容器外，避免滚动后的参数与固定端口标签重叠。 */
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const inspector = useContext(MediaNodeInspectorContext);
  const nodeRun = useWorkflowStore((state) =>
    state.run?.nodes.find((node) => node.nodeId === nodeId),
  );
  const partialRerunState = usePartialRerunNodeVisualState(nodeId);
  const running = nodeRun?.status === "running";
  const progress =
    typeof nodeRun?.progress === "number" && Number.isFinite(nodeRun.progress)
      ? Math.round(Math.min(1, Math.max(0, nodeRun.progress)) * 100)
      : undefined;

  if (inspector)
    return (
      <section className="workflow-node-inspector space-y-3 p-4 text-sm">
        <h3 className="flex items-center gap-2 font-semibold">
          {icon}
          {title}
        </h3>
        <div className="relative min-h-40 pb-10">{children}</div>
        {nodeRun?.error && (
          <details>
            <summary className="text-destructive">最近运行错误</summary>
            <p className="whitespace-pre-wrap break-words">{nodeRun.error}</p>
          </details>
        )}
      </section>
    );

  return (
    <div
      data-run-status={nodeRun?.status}
      data-partial-rerun-state={partialRerunState ?? undefined}
      inert={partialRerunState ? true : undefined}
      aria-current={running ? "step" : undefined}
      className={cn(
        "relative flex h-full w-full flex-col overflow-visible rounded-xl border bg-card shadow-node transition-shadow",
        selected ? "border-primary ring-2 ring-primary/15" : "border-border",
        nodeRun?.status === "queued" && "border-muted-foreground/35",
        running && "canvas-node-busy border-primary ring-2 ring-primary/15",
        nodeRun?.status === "failed" && "border-destructive/50",
        partialRerunState === "unavailable" && "opacity-40 saturate-50",
        partialRerunState === "reuse" && "border-emerald-500/80",
        partialRerunState === "rerun" &&
          "border-dashed border-amber-500/90 ring-1 ring-amber-500/15",
        partialRerunState === "start" && "border-amber-500 ring-2 ring-amber-500/20",
      )}
    >
      <header
        className={cn(
          "flex h-11 shrink-0 items-center gap-2 rounded-t-[inherit] border-b px-3",
          running && "border-primary/20 bg-primary/5",
          nodeRun?.status === "failed" && "border-destructive/20 bg-destructive/5",
          partialRerunState === "reuse" && "bg-success/5",
          (partialRerunState === "rerun" || partialRerunState === "start") && "bg-warning/5",
        )}
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{title}</span>
        {partialRerunState === "reuse" ||
        partialRerunState === "rerun" ||
        partialRerunState === "start" ? (
          <PartialRerunStatus state={partialRerunState} />
        ) : (
          <RunStatus status={nodeRun?.status} progress={progress} />
        )}
      </header>

      <div
        className={cn(
          "nowheel relative min-h-0 flex-1 overflow-auto rounded-b-[inherit]",
          bodyClassName,
        )}
      >
        {children}
      </div>

      {inputs.map((port, index) => (
        <div
          key={`in:${port.id}`}
          className="pointer-events-none absolute left-0 flex -translate-y-1/2 items-center"
          style={{ top: 58 + index * 30 }}
        >
          <Handle
            id={port.id}
            type="target"
            position={Position.Left}
            className={cn(
              "pointer-events-auto !relative !inset-auto !size-3 !-translate-x-1/2 !translate-y-0 !border-2 !border-background",
              portColour[port.type],
            )}
          />
          <span className="ml-2 rounded bg-background/90 px-1 text-[0.625rem] text-muted-foreground">
            {port.label}
          </span>
        </div>
      ))}

      {outputs.map((port, index) => (
        <div
          key={`out:${port.id}`}
          className="pointer-events-none absolute right-0 flex -translate-y-1/2 items-center"
          style={{ top: 58 + index * 30 }}
        >
          <span className="mr-2 rounded bg-background/90 px-1 text-[0.625rem] text-muted-foreground">
            {port.label}
          </span>
          <Handle
            id={port.id}
            type="source"
            position={Position.Right}
            className={cn(
              "pointer-events-auto !relative !inset-auto !size-3 !translate-x-1/2 !translate-y-0 !border-2 !border-background",
              portColour[port.type],
            )}
          />
        </div>
      ))}

      {nodeRun?.status === "failed" && <NodeFeedback message={nodeRun.error ?? "执行失败"} />}

      {running && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-muted">
          <div
            className={cn(
              "h-full bg-primary transition-[width] duration-300",
              progress === undefined && "w-1/3 animate-pulse",
            )}
            style={progress === undefined ? undefined : { width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function PartialRerunStatus({
  state,
}: {
  state: Exclude<PartialRerunNodeVisualState, "candidate" | "unavailable" | null>;
}) {
  const t = useT();
  if (state === "reuse") {
    return (
      <span className="flex items-center gap-1 text-[0.625rem] font-medium text-emerald-600 dark:text-emerald-400">
        <LockKeyhole className="size-3" aria-hidden />
        {t("workflow.statusWillReuse")}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[0.625rem] font-medium text-amber-600 dark:text-amber-400">
      <RotateCcw className="size-3" aria-hidden />
      {t(state === "start" ? "workflow.statusRerunStart" : "workflow.statusWillRerun")}
    </span>
  );
}

function RunStatus({
  status,
  progress,
}: {
  status?: "queued" | "running" | "retrying" | "succeeded" | "failed" | "cancelled" | "skipped";
  progress?: number;
}) {
  const t = useT();
  if (!status) return null;
  if (status === "queued") {
    return (
      <span className="flex items-center gap-1 text-[0.625rem] text-muted-foreground">
        <Clock3 className="size-3" aria-hidden />
        {t("workflow.statusQueued")}
      </span>
    );
  }
  if (status === "running" || status === "retrying") {
    return (
      <span
        className="flex items-center gap-1 text-[0.625rem] font-medium text-primary"
        aria-live="polite"
      >
        <Loader2 className="size-3 animate-spin" aria-hidden />
        {t(status === "retrying" ? "workflow.statusRetrying" : "workflow.statusRunning")}
        {progress !== undefined ? ` ${progress}%` : ""}
      </span>
    );
  }
  if (status === "succeeded") {
    return (
      <span className="flex items-center gap-1 text-[0.625rem] text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3.5" aria-hidden />
        {t("workflow.statusSucceeded")}
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex items-center gap-1 text-[0.625rem] text-destructive">
        <XCircle className="size-3.5" aria-hidden />
        {t("workflow.statusFailed")}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[0.625rem] text-muted-foreground">
      <MinusCircle className="size-3.5" aria-hidden />
      {t(status === "cancelled" ? "workflow.statusCancelled" : "workflow.statusSkipped")}
    </span>
  );
}
