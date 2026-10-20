"use client";

import { type NodeProps, NodeResizer, useReactFlow } from "@xyflow/react";
import { Film, Sparkles } from "lucide-react";
import { useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  fixedVideoResolution,
  supportsVideoImageInputMode,
  usesSeedanceVideoParameters,
  videoParameterOptions,
  videoResolutionLabel,
} from "@/features/ai/video-models";
import { runVideoNode } from "@/features/canvas/execution";
import { ChipRow, ModelPicker, useSelection } from "@/features/ai/model-picker";
import { NodeShell } from "@/features/canvas/nodes/node-shell";
import { useCanvasStore } from "@/features/canvas/store";
import {
  DEFAULT_SEEDANCE_INPUT_MODE,
  DEFAULT_VIDEO_DURATION,
  isValidVideoDuration,
  NODE_MIN_SIZE,
  type VideoGenNodeData,
  VIDEO_DURATION_MAX,
} from "@/features/canvas/types";
import { cn } from "@/lib/utils";

const FPS_OPTIONS = [16, 24] as const;
const VIDEO_ASPECTS = ["16:9", "9:16", "1:1"] as const;
const SEEDANCE_INPUT_MODES = ["reference", "first-last"] as const;

/**
 * 视频生成配置。
 *
 * 不同协议支持的参数差异很大，因此这里按协议分支显示，而不是展示全部控件：
 *  - `seedance-video` 接受完整参数集，包括帧率、水印和音频。
 *  - `openai-video`（Sora）、`minimax-video` 和 `xai-video` 只接受时长、画面比例和分辨率；
 *    发送帧率或种子会被拒绝。
 *  - `minimax-h3` 使用官方 content 输入，支持参考图与首尾帧，时长至少 4 秒。
 *  - xAI 最高支持 720p，因此直接隐藏 1080p，避免显示后再被服务端拒绝。
 */
export function VideoGenNode({ id, data, selected }: NodeProps) {
  const t = useT();
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const { getNodes, getEdges } = useReactFlow();

  const nodeData = data as VideoGenNodeData;
  const selection = useSelection(nodeData.providerId, nodeData.modelId);
  const durationSource = nodeData.duration ?? DEFAULT_VIDEO_DURATION;
  const [durationEdit, setDurationEdit] = useState({
    source: durationSource,
    draft: String(durationSource),
  });

  // 属性变化可能来自撤销、加载或其他编辑器。渲染时直接重置草稿，避免输入框短暂显示一帧旧值。
  if (durationEdit.source !== durationSource) {
    setDurationEdit({ source: durationSource, draft: String(durationSource) });
  }

  const durationDraft =
    durationEdit.source === durationSource ? durationEdit.draft : String(durationSource);
  const parsedDuration = Number(durationDraft);
  const protocol = selection?.protocol;
  const { resolutions, durationMin } = videoParameterOptions(
    selection?.model.modelKey ?? "",
    protocol,
  );
  const durationValid =
    durationDraft.trim() !== "" &&
    isValidVideoDuration(parsedDuration) &&
    parsedDuration >= durationMin;
  const supportsInputMode = selection
    ? supportsVideoImageInputMode(selection.model.modelKey, protocol, selection.provider?.builtinId)
    : false;
  const isSeedance = selection
    ? usesSeedanceVideoParameters(selection.model.modelKey, protocol)
    : false;
  const seedanceInputMode = nodeData.seedanceInputMode ?? DEFAULT_SEEDANCE_INPUT_MODE;
  const fixedResolution = selection ? fixedVideoResolution(selection.model.modelKey) : null;
  const resolutionValid = resolutions.includes(fixedResolution ?? nodeData.resolution ?? "720p");

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_SIZE.width}
        minHeight={240}
        lineClassName="!border-ring"
        handleClassName="!size-2 !rounded-sm !border-ring !bg-background"
      />

      <NodeShell
        title={t("canvas.nodeVideoGen")}
        icon={<Film className="size-3 shrink-0 text-muted-foreground" aria-hidden />}
        selected={selected}
        // 此处只会记录尚未创建独立结果节点便发生的失败；进行中的任务状态保存在它创建的视频节点上。
        execution={nodeData.execution}
        onRetry={() => void runVideoNode(id, getNodes(), getEdges())}
      >
        <div className="nodrag nowheel flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <ModelPicker
            category="video"
            providerId={nodeData.providerId}
            modelId={nodeData.modelId}
            onChange={(next) => updateNodeData(id, next)}
          />

          {selection && (
            <>
              {supportsInputMode && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{t("node.videoInputMode")}</span>
                  <div className="flex flex-wrap gap-1">
                    {SEEDANCE_INPUT_MODES.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={seedanceInputMode === mode}
                        onClick={() => updateNodeData(id, { seedanceInputMode: mode })}
                        className={cn(
                          "rounded border px-1.5 py-0.5 text-xs transition-colors",
                          seedanceInputMode === mode
                            ? "border-primary/40 bg-accent text-primary"
                            : "border-border text-muted-foreground hover:bg-accent",
                        )}
                      >
                        {t(
                          mode === "first-last"
                            ? "node.videoInputFirstLast"
                            : "node.videoInputReference",
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-[0.6875rem] leading-4 text-muted-foreground">
                    {t(
                      seedanceInputMode === "first-last"
                        ? "node.videoInputFirstLastHint"
                        : "node.videoInputReferenceHint",
                    )}
                  </p>
                </div>
              )}

              <ChipRow
                label={t("node.aspect")}
                options={VIDEO_ASPECTS}
                value={nodeData.aspect ?? "16:9"}
                onChange={(aspect) => updateNodeData(id, { aspect })}
              />

              <ChipRow
                label={t("node.resolution")}
                options={resolutions}
                formatOption={(value) => videoResolutionLabel(value, protocol)}
                value={fixedResolution ?? nodeData.resolution ?? "720p"}
                onChange={(resolution) => updateNodeData(id, { resolution })}
              />

              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{t("node.durationSeconds")}</span>
                <input
                  type="number"
                  min={durationMin}
                  max={VIDEO_DURATION_MAX}
                  step={1}
                  value={durationDraft}
                  onChange={(event) => {
                    const next = event.target.value;
                    const parsed = Number(next);
                    setDurationEdit({ source: durationSource, draft: next });

                    if (
                      next.trim() !== "" &&
                      isValidVideoDuration(parsed) &&
                      parsed >= durationMin
                    ) {
                      updateNodeData(id, { duration: parsed });
                    }
                  }}
                  aria-label={t("node.durationSeconds")}
                  aria-invalid={!durationValid}
                  className="h-8 rounded border border-input bg-transparent px-1.5 text-[0.6875rem] outline-none focus-visible:border-ring aria-invalid:border-destructive"
                />
              </div>

              {protocol === "minimax-h3" && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{t("node.watermark")}</span>
                  <Switch
                    isSelected={nodeData.watermark ?? false}
                    onChange={(value) => updateNodeData(id, { watermark: value })}
                    aria-label={t("node.watermark")}
                  />
                </div>
              )}

              {isSeedance && (
                <>
                  <ChipRow
                    label={t("node.fps")}
                    options={FPS_OPTIONS}
                    value={nodeData.fps ?? 24}
                    onChange={(fps) => updateNodeData(id, { fps })}
                  />

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{t("node.generateAudio")}</span>
                    <Switch
                      isSelected={nodeData.generateAudio ?? false}
                      onChange={(value) => updateNodeData(id, { generateAudio: value })}
                      aria-label={t("node.generateAudio")}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{t("node.watermark")}</span>
                    <Switch
                      isSelected={nodeData.watermark ?? false}
                      onChange={(value) => updateNodeData(id, { watermark: value })}
                      aria-label={t("node.watermark")}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="nodrag shrink-0 border-t p-1.5">
          {/* 不因已有任务正在运行而禁用：每次点击都会启动独立的生成任务，已有任务可从其正在填充的节点中停止。 */}
          <Button
            size="sm"
            className="w-full text-[0.6875rem]"
            isDisabled={!selection || !durationValid || !resolutionValid}
            onPress={() => void runVideoNode(id, getNodes(), getEdges())}
          >
            <Sparkles className="size-3" aria-hidden />
            {t("node.generate")}
          </Button>
        </div>
      </NodeShell>
    </>
  );
}
