"use client";

import { ArrowLeftRight, ImageIcon } from "lucide-react";
import { useT } from "@/components/providers/i18n-provider";
import { useWorkflowEditorEnvironment } from "@/features/workflow/editor-environment";
import { useWorkflowStore } from "@/features/workflow/store";
import { orderedVideoFrames, workflowVideoImages } from "@/features/workflow/video-inputs";

/** 首尾帧预览所需的已保存节点配置。 */
interface WorkflowVideoFramesProps {
  /** 正在编辑的视频生成节点。 */
  nodeId: string;
  /** 是否交换原始连线顺序中的两张图片。 */
  reverseFrames?: boolean;
}

/** 在原有图片端口上明确展示帧角色，交换操作只修改当前视频节点。 */
export function WorkflowVideoFrames({ nodeId, reverseFrames }: WorkflowVideoFramesProps) {
  const t = useT();
  const { assetUrl } = useWorkflowEditorEnvironment();
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const update = useWorkflowStore((state) => state.updateNodeData);
  const images = workflowVideoImages(nodeId, nodes, edges);
  const frames = orderedVideoFrames(images, "first-last", reverseFrames);
  const tooMany = images.length > 2;

  // 上次运行的输出可能已经过期。动态图片显示来源占位，实际数量由后端在提交前再次校验。
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-2">
      {tooMany ? (
        <p role="alert" className="text-[0.625rem] leading-4 text-destructive">
          {t("workflow.videoFramesTooMany")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {(["first", "last"] as const).map((role, index) => {
            const frame = frames[index];
            const label = t(
              role === "first" ? "workflow.videoFirstFrame" : "workflow.videoLastFrame",
            );
            return (
              <div key={role} className="min-w-0" data-frame-role={role}>
                <div className="mb-1 text-[0.625rem] font-medium">{label}</div>
                <div className="flex h-16 items-center justify-center overflow-hidden rounded-md border bg-background">
                  {frame?.url ? (
                    // 用户素材沿用工作流已有的同源素材地址，不使用会代理下载图片的优化服务。
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={assetUrl(frame.url)}
                      alt={label}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
                  )}
                </div>
                <p className="mt-1 break-words text-[0.625rem] leading-4 text-muted-foreground">
                  {frame
                    ? t(
                        frame.pending ? "workflow.videoFramePending" : "workflow.videoFrameSource",
                        {
                          index: images.indexOf(frame) + 1,
                        },
                      )
                    : t(
                        role === "first"
                          ? "workflow.videoFirstFrameEmpty"
                          : "workflow.videoLastFrameEmpty",
                      )}
                </p>
              </div>
            );
          })}
        </div>
      )}
      <button
        type="button"
        disabled={images.length !== 2}
        onClick={() => update(nodeId, { reverseFrames: !reverseFrames })}
        className="flex h-7 items-center justify-center gap-1 rounded-md border bg-background text-[0.625rem] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ArrowLeftRight className="size-3" aria-hidden />
        {t("workflow.videoSwapFrames")}
      </button>
      <p className="text-[0.625rem] leading-4 text-muted-foreground">
        {t("workflow.videoFramesHint")}
      </p>
    </div>
  );
}
