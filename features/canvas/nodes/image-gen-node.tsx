"use client";

import { type NodeProps, NodeResizer, useReactFlow } from "@xyflow/react";
import { Sparkles, Wand2 } from "lucide-react";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { ChipRow, ModelPicker, useSelection } from "@/features/canvas/nodes/model-picker";
import { NodeShell } from "@/features/canvas/nodes/node-shell";
import { useCanvasStore } from "@/features/canvas/store";
import { runImageNode } from "@/features/canvas/execution";
import {
  ASPECT_RATIOS,
  DEFAULT_IMAGE_OUTPUT_FORMAT,
  IMAGE_OUTPUT_FORMATS,
  type ImageGenNodeData,
  NODE_MIN_SIZE,
} from "@/features/canvas/types";

const QUALITIES = ["auto", "low", "medium", "high"] as const;
const COUNTS = [1, 2, 3, 4] as const;

/**
 * 图片生成配置。
 *
 * 显示哪些参数取决于最终解析出的协议，而不是提供商：质量和输出格式是 OpenAI Images
 * 协议的概念，Gemini 不接受这些参数，因此在 Gemini 下提供这些选项会产生上游拒绝的请求。
 */
export function ImageGenNode({ id, data, selected }: NodeProps) {
  const t = useT();
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const { getNodes, getEdges } = useReactFlow();

  const nodeData = data as ImageGenNodeData;
  const selection = useSelection(nodeData.providerId, nodeData.modelId);

  const isOpenAiImages = selection?.protocol === "openai-images";
  const supportsSeed = selection?.protocol !== "openai-images";

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_SIZE.width}
        minHeight={220}
        lineClassName="!border-ring"
        handleClassName="!size-2 !rounded-sm !border-ring !bg-background"
      />

      <NodeShell
        title={t("canvas.nodeImageGen")}
        icon={<Wand2 className="size-3 shrink-0 text-muted-foreground" aria-hidden />}
        selected={selected}
        // 此处只会记录尚未创建独立结果节点便发生的失败；进行中的任务状态保存在它创建的图片节点上。
        execution={nodeData.execution}
        onRetry={() => void runImageNode(id, getNodes(), getEdges())}
      >
        <div className="nodrag nowheel flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <ModelPicker
            category="image"
            providerId={nodeData.providerId}
            modelId={nodeData.modelId}
            onChange={(next) => updateNodeData(id, next)}
          />

          {selection && (
            <>
              <ChipRow
                label={t("node.aspect")}
                options={ASPECT_RATIOS}
                value={nodeData.aspect ?? "1:1"}
                onChange={(aspect) => updateNodeData(id, { aspect })}
              />

              {isOpenAiImages && (
                <>
                  <ChipRow
                    label={t("node.quality")}
                    options={QUALITIES}
                    value={nodeData.quality ?? "auto"}
                    onChange={(quality) => updateNodeData(id, { quality })}
                  />

                  <ChipRow
                    label={t("node.outputFormat")}
                    options={IMAGE_OUTPUT_FORMATS}
                    value={nodeData.outputFormat ?? DEFAULT_IMAGE_OUTPUT_FORMAT}
                    onChange={(outputFormat) => updateNodeData(id, { outputFormat })}
                  />
                </>
              )}

              <ChipRow
                label={t("node.count")}
                options={COUNTS}
                value={nodeData.count ?? 1}
                onChange={(count) => updateNodeData(id, { count })}
              />

              {supportsSeed && (
                <div className="flex flex-col gap-1">
                  <span className="text-[0.625rem] text-muted-foreground">{t("node.seed")}</span>
                  <input
                    type="number"
                    value={nodeData.seed ?? ""}
                    onChange={(event) =>
                      updateNodeData(id, {
                        seed: event.target.value ? Number(event.target.value) : undefined,
                      })
                    }
                    placeholder={t("node.seedPlaceholder")}
                    aria-label={t("node.seed")}
                    className="h-6 rounded border border-input bg-transparent px-1.5 text-[0.6875rem] outline-none focus-visible:border-ring"
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="nodrag shrink-0 border-t p-2.5">
          {/* 不因已有任务正在运行而禁用：每次点击都会启动独立的生成任务，已有任务可从其正在填充的节点中停止。 */}
          <Button
            size="sm"
            className="w-full text-xs"
            isDisabled={!selection}
            onPress={() => void runImageNode(id, getNodes(), getEdges())}
          >
            <Sparkles className="size-3" aria-hidden />
            {t("node.generate")}
          </Button>
        </div>
      </NodeShell>
    </>
  );
}
