"use client";

import { extractVideoLastFrame, type UploadedAsset } from "@/features/ai/api";
import { useAiStore } from "@/features/ai/store";
import { resolveProtocol } from "@/features/ai/types";
import { supportsVideoImageInputMode } from "@/features/ai/video-models";
import type { CanvasEdge, CanvasNode } from "@/features/canvas/store";
import { useCanvasStore } from "@/features/canvas/store";
import type { VideoGenNodeData, VideoNodeData } from "@/features/canvas/types";

export interface VideoContinuationResult {
  frame: Pick<UploadedAsset, "url" | "mediaType">;
  imageNodeId: string | null;
  generationNodeId: string | null;
}

/**
 * 将视频末帧具体化为普通图片节点。可选地在其后添加已配置的视频生成节点，
 * 但刻意不启动会计费的生成请求。
 */
export async function createVideoLastFrameBranch(
  videoNodeId: string,
  video: VideoNodeData,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  continueGeneration: boolean,
): Promise<VideoContinuationResult> {
  if (!video.assetUrl) throw new Error("The video result is not available yet.");

  const frame = video.lastFrameUrl
    ? {
        url: video.lastFrameUrl,
        mediaType: video.lastFrameMediaType ?? "image/png",
      }
    : await extractVideoLastFrame(video.assetUrl);

  const store = useCanvasStore.getState();
  store.updateNodeData(
    videoNodeId,
    {
      lastFrameUrl: frame.url,
      lastFrameMediaType: frame.mediaType,
    },
    { history: false },
  );

  const imageNodeId = store.spawnOutput(videoNodeId, "image", {
    assetUrl: frame.url,
    mediaType: frame.mediaType,
    prompt: video.prompt,
    providerId: video.providerId,
    modelId: video.modelId,
    role: "reference",
  });

  if (!continueGeneration || !imageNodeId) {
    return { frame, imageNodeId, generationNodeId: null };
  }

  const source = edges
    .filter((edge) => edge.target === videoNodeId)
    .map((edge) => nodes.find((node) => node.id === edge.source))
    .find((node) => node?.type === "videoGen");
  const sourceData = source?.data as VideoGenNodeData | undefined;
  const copied: Partial<VideoGenNodeData> = { ...sourceData };
  delete copied.execution;
  const config: Partial<VideoGenNodeData> = {
    ...copied,
    providerId: copied.providerId ?? video.providerId,
    modelId: copied.modelId ?? video.modelId,
  };

  const providers = useAiStore.getState().providers;
  const provider = providers.find((candidate) => candidate.id === config.providerId);
  const model = provider?.models.find((candidate) => candidate.id === config.modelId);
  const protocol = provider ? resolveProtocol(provider, model) : undefined;
  if (model && supportsVideoImageInputMode(model.modelKey, protocol)) {
    config.seedanceInputMode = "first-last";
  } else {
    delete config.seedanceInputMode;
  }

  const generationNodeId = store.spawnOutput(imageNodeId, "videoGen", config);
  return { frame, imageNodeId, generationNodeId };
}
