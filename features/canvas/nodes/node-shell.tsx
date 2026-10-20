"use client";

import { Handle, Position } from "@xyflow/react";
import { CheckCircle2, Loader2, Square } from "lucide-react";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { NodeFeedback } from "@/components/ui/node-feedback";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import type { NodeExecution } from "@/features/canvas/types";
import { cn } from "@/lib/utils";

/**
 * 所有节点共用的外框：边框、两个连接手柄以及执行反馈。
 *
 * 连接手柄沿用 OpenCowork 的设计，为不带 ID 的左右圆点。每个节点只有一个输入和一个输出，
 * 给端口增加类型只会带来额外的学习规则，在此没有实际收益。
 */
export function NodeShell({
  title,
  icon,
  selected,
  execution,
  children,
  actions,
  className,
  onRetry,
  onCancel,
  footer,
}: {
  title: string;
  icon?: React.ReactNode;
  selected?: boolean;
  execution?: NodeExecution;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  onRetry?: () => void;
  /** 持久任务的恢复控件独立于预览遮罩。 */
  footer?: React.ReactNode;
  /**
   * 停止此节点所属的运行任务。
   *
   * 该回调由任务创建出的节点传入，而非启动任务的节点。加载指示器显示在这里，
   * 因此结束任务的按钮也应放在这里。
   */
  onCancel?: () => void;
}) {
  const t = useT();
  const busy = execution?.status === "queued" || execution?.status === "running";
  const statusLabel =
    execution?.phase === "submitting"
      ? t("imageJob.submitting")
      : execution?.phase === "saving"
        ? t("imageJob.saving")
        : execution?.status === "queued"
          ? t("node.queued")
          : t("node.generating");
  const progress =
    typeof execution?.progress === "number" && Number.isFinite(execution.progress)
      ? Math.round(Math.min(1, Math.max(0, execution.progress)) * 100)
      : undefined;

  return (
    <div
      className={cn(
        "canvas-node relative flex h-full w-full flex-col rounded-xl border bg-card shadow-node",
        selected ? "border-primary ring-2 ring-primary/15" : "border-border hover:border-ring/45",
        busy && "canvas-node-busy",
        className,
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-2 !border-background !bg-muted-foreground transition-transform duration-150 hover:!scale-125"
      />

      <header className="flex min-h-10 shrink-0 items-center gap-2 rounded-t-[inherit] border-b px-3 py-2">
        {icon}
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{title}</span>
        {execution?.status === "succeeded" && (
          <CheckCircle2
            className="size-3.5 shrink-0 text-success"
            aria-label={t("workflow.statusSucceeded")}
          />
        )}
        {/* nodrag 可防止点击按钮时触发画布拖动。 */}
        {actions && <div className="nodrag flex shrink-0 items-center gap-0.5">{actions}</div>}
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-[inherit]">
        {children}

        {busy && (
          <div className="canvas-sweep canvas-fade-in nodrag absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden bg-background/70 backdrop-blur-[1px]">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            <p className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
              <span>{statusLabel}</span>
              {progress !== undefined && (
                <span className="font-medium tabular-nums text-foreground">{progress}%</span>
              )}
            </p>
            {progress !== undefined && (
              <div
                role="progressbar"
                aria-label={statusLabel}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="h-1 w-24 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full bg-primary transition-[width] duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            {onCancel && (
              <Button
                size="xs"
                variant="outline"
                className="mt-0.5 h-5 px-2 text-[0.625rem]"
                onPress={onCancel}
              >
                <Square className="size-2.5" aria-hidden />
                {t("node.stop")}
              </Button>
            )}
          </div>
        )}
      </div>

      {(execution?.status === "failed" ||
        execution?.status === "interrupted" ||
        execution?.status === "cancelled") && (
        <NodeFeedback
          message={
            execution.status === "interrupted"
              ? t("node.interrupted")
              : execution.status === "cancelled"
                ? t("node.stop")
                : (execution.error ?? t("node.failed"))
          }
          actions={
            onRetry && (
              <Button size="xs" variant="ghost" className="text-xs" onPress={onRetry}>
                {t("node.retry")}
              </Button>
            )
          }
        />
      )}

      {footer}

      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-2 !border-background !bg-muted-foreground transition-transform duration-150 hover:!scale-125"
      />
    </div>
  );
}

/**
 * 节点标题栏中仅显示图标的操作按钮。工具提示会展示原本只能由屏幕阅读器读取的标签，
 * 因为节点正文空间不足以显示文字。
 */
export function NodeActionButton({
  label,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <TooltipTrigger>
      <Button aria-label={label} {...props} />
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}
