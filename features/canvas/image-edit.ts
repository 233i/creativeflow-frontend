"use client";

import { uploadAsset, type UploadedAsset } from "@/features/ai/api";
import { toUploadFile } from "@/features/canvas/image-ops";
import { useCanvasStore } from "@/features/canvas/store";
import type { CanvasNodeData, NodeKind } from "@/features/canvas/types";

export interface AppliedImageEdit {
  nodeId: string;
  assetUrl: string;
  mediaType: string;
}

interface ImageEditDependencies {
  upload?: (file: File) => Promise<UploadedAsset>;
  spawn?: (
    sourceId: string,
    kind: NodeKind,
    data?: Partial<CanvasNodeData>,
    stackIndex?: number,
  ) => string | null;
}

/**
 * 生成、上传并放置一次本地图片编辑结果。
 *
 * 节点界面和智能体执行器共享此逻辑，使二者都保留源图片，
 * 并使用相同的持久素材路由和输出放置语义。
 */
export async function applyImageEdit(
  sourceNodeId: string,
  sourceUrl: string,
  produce: (url: string) => Promise<Blob>,
  label: string,
  data: { role?: "reference" | "inpaint-mask" } = {},
  dependencies: ImageEditDependencies = {},
): Promise<AppliedImageEdit> {
  const blob = await produce(sourceUrl);
  const asset = await (dependencies.upload ?? uploadAsset)(toUploadFile(blob, label));
  const spawn = dependencies.spawn ?? useCanvasStore.getState().spawnOutput;
  const nodeId = spawn(sourceNodeId, "image", {
    assetUrl: asset.url,
    mediaType: asset.mediaType,
    ...data,
  });
  if (!nodeId) throw new Error("output_node_creation_failed");

  return { nodeId, assetUrl: asset.url, mediaType: asset.mediaType };
}
