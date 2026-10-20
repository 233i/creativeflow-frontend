"use client";

import { type NodeProps, NodeResizer, useReactFlow } from "@xyflow/react";
import { ImageDown, Loader2, StepForward, Video } from "lucide-react";
import { useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { cancelRun, retryRun } from "@/features/canvas/execution";
import { NodeActionButton, NodeShell } from "@/features/canvas/nodes/node-shell";
import { NODE_MIN_SIZE, type VideoNodeData } from "@/features/canvas/types";
import { createVideoLastFrameBranch } from "@/features/canvas/video-continuation";

export function VideoNode({ id, data, selected }: NodeProps) {
  const t = useT();
  const { getNodes, getEdges } = useReactFlow();
  const nodeData = data as VideoNodeData;
  const [action, setAction] = useState<"extract" | "continue" | null>(null);
  const [frameError, setFrameError] = useState<string | null>(null);

  async function branch(continueGeneration: boolean) {
    if (!nodeData.assetUrl || action) return;
    setAction(continueGeneration ? "continue" : "extract");
    setFrameError(null);
    try {
      await createVideoLastFrameBranch(id, nodeData, getNodes(), getEdges(), continueGeneration);
    } catch (error) {
      setFrameError(error instanceof Error ? error.message : t("node.extractLastFrameFailed"));
    } finally {
      setAction(null);
    }
  }

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_SIZE.width}
        minHeight={NODE_MIN_SIZE.height}
        lineClassName="!border-ring"
        handleClassName="!size-2 !rounded-sm !border-ring !bg-background"
      />

      <NodeShell
        title={t("canvas.nodeVideo")}
        icon={<Video className="size-3 shrink-0 text-muted-foreground" aria-hidden />}
        selected={selected}
        execution={nodeData.execution}
        onCancel={() => cancelRun(id)}
        onRetry={() => void retryRun(id, getNodes(), getEdges())}
        actions={
          nodeData.assetUrl ? (
            <>
              <NodeActionButton
                size="icon-xs"
                variant="ghost"
                className="size-5"
                isDisabled={action !== null}
                label={t("node.extractLastFrame")}
                onPress={() => void branch(false)}
              >
                {action === "extract" ? (
                  <Loader2 className="size-2.5 animate-spin" aria-hidden />
                ) : (
                  <ImageDown className="size-2.5" aria-hidden />
                )}
              </NodeActionButton>
              <NodeActionButton
                size="icon-xs"
                variant="ghost"
                className="size-5"
                isDisabled={action !== null}
                label={t("node.continueFromLastFrame")}
                onPress={() => void branch(true)}
              >
                {action === "continue" ? (
                  <Loader2 className="size-2.5 animate-spin" aria-hidden />
                ) : (
                  <StepForward className="size-2.5" aria-hidden />
                )}
              </NodeActionButton>
            </>
          ) : undefined
        }
      >
        <div className="nodrag flex h-full w-full items-center justify-center overflow-hidden bg-black/80">
          {nodeData.assetUrl ? (
            <video
              src={nodeData.assetUrl}
              poster={nodeData.posterUrl}
              controls
              className="size-full object-contain"
            />
          ) : (
            <p className="text-[0.6875rem] text-white/60">{t("node.noVideo")}</p>
          )}
          {frameError && (
            <p
              role="alert"
              className="absolute inset-x-2 bottom-2 rounded-md bg-background/90 px-2 py-1 text-[0.625rem] text-destructive shadow"
            >
              {frameError}
            </p>
          )}
        </div>
      </NodeShell>
    </>
  );
}
