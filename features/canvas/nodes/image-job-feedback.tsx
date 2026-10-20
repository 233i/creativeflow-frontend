"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  queryImageJob,
  regenerateImageJob,
  retryImageDownload,
} from "@/features/canvas/image-jobs";
import type { ImageNodeData } from "@/features/canvas/types";
import { cn } from "@/lib/utils";

export function formatImageJobElapsed(start: number, end: number): string {
  const seconds = Number.isFinite(start) ? Math.max(0, Math.floor((end - start) / 1000)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** 图像任务的恢复操作始终在预览下方，不被加载遮罩覆盖。 */
export function ImageJobFeedback({ nodeId, data }: { nodeId: string; data: ImageNodeData }) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = data.imageJob!;
  const active = !link.status || ["queued", "generating", "saving"].includes(link.status);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const stage = data.execution?.phase;
  const stages = ["queued", "generating", "saving"] as const;
  const elapsed = formatImageJobElapsed(
    data.execution?.startedAt ?? now,
    data.execution?.finishedAt ?? now,
  );

  async function act(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(
        (failure as { status?: number })?.status === 404
          ? t("imageJob.notFound")
          : failure instanceof Error
            ? failure.message
            : t("errors.unknown"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="nodrag nowheel shrink-0 space-y-2 border-t bg-muted/20 px-3 py-2 text-[0.6875rem]">
      <ol
        aria-label={t("imageJob.stages")}
        className="flex flex-wrap items-center gap-1.5 text-muted-foreground"
      >
        {stages.map((step, index) => (
          <li
            key={step}
            aria-current={step === stage ? "step" : undefined}
            className={cn(
              "flex items-center gap-1.5",
              step === stage && "font-semibold text-foreground",
            )}
          >
            {index > 0 && <span aria-hidden>→</span>}
            {t(`imageJob.${step}`)}
          </li>
        ))}
        <li className="ml-auto tabular-nums">
          {t(active ? "imageJob.waited" : "imageJob.elapsed", { time: elapsed })}
        </li>
      </ol>
      {active && <p className="text-muted-foreground">{t("imageJob.background")}</p>}
      {link.connectionLost && (
        <p role="status" className="text-muted-foreground">
          {t("imageJob.disconnected")}
        </p>
      )}
      {data.jobId && (
        <p className="truncate text-muted-foreground" title={data.jobId}>
          {t("imageJob.taskId")}: {data.jobId.slice(0, 8)}…
        </p>
      )}
      <div className="flex flex-wrap gap-1">
        <Button
          size="xs"
          variant="outline"
          isDisabled={busy}
          onPress={() => void act(() => queryImageJob(nodeId))}
        >
          {t("imageJob.query")}
        </Button>
        <Button
          size="xs"
          variant="outline"
          isDisabled={busy || !link.canRetryDownload}
          onPress={() => void act(() => retryImageDownload(nodeId))}
        >
          {t("imageJob.download")}
        </Button>
        <Button size="xs" variant="ghost" isDisabled={busy} onPress={() => setConfirm(true)}>
          {t("imageJob.regenerate")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="max-h-20 overflow-y-auto break-words text-destructive">
          {error}
        </p>
      )}
      <ConfirmDialog
        isOpen={confirm}
        onOpenChange={setConfirm}
        variant="default"
        title={t("imageJob.confirmTitle")}
        description={t("imageJob.confirmDescription")}
        confirmLabel={t("imageJob.confirmGenerate")}
        onConfirm={() => act(() => regenerateImageJob(nodeId))}
      />
    </div>
  );
}
