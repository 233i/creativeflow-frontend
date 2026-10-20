import type { AiModel, AiProvider, ProviderType } from "@/features/ai/types";
import { resolveProtocol } from "@/features/ai/types";

export type VideoResolution = "480p" | "720p" | "1080p";

export const XAI_VIDEO_EXTENSION_MODEL_KEY = "grok-imagine-video";

interface VideoSlotSelection {
  providerId: string | null;
  modelId: string | null;
}

export interface ResolvedVideoExtensionModel {
  provider: AiProvider;
  model: AiModel;
  protocol: "xai-video";
}

/**
 * 续接使用全局视频角色所选供应商，但 xAI 当前要求使用基础 Grok Imagine Video 模型，
 * 即使首段视频由 1.5 模型渲染。
 */
export function resolveVideoExtensionModel(
  providers: AiProvider[],
  slot: VideoSlotSelection,
): ResolvedVideoExtensionModel | null {
  if (!slot.providerId || !slot.modelId) return null;
  const provider = providers.find((candidate) => candidate.id === slot.providerId);
  if (!provider?.enabled) return null;

  const selectedModel = provider.models.find((candidate) => candidate.id === slot.modelId);
  if (!selectedModel?.enabled || selectedModel.category !== "video") return null;

  const model = provider.models.find(
    (candidate) =>
      candidate.enabled &&
      candidate.category === "video" &&
      candidate.modelKey.toLowerCase() === XAI_VIDEO_EXTENSION_MODEL_KEY &&
      resolveProtocol(provider, candidate) === "xai-video",
  );
  return model ? { provider, model, protocol: "xai-video" } : null;
}

/** Routin SD 模型标识中编码了其唯一支持的输出分辨率。 */
export function fixedVideoResolution(modelKey: string): VideoResolution | null {
  const match = /^sd-(?:mini|fast|2\.0)-(480p|720p|1080p)$/i.exec(modelKey);
  return (match?.[1]?.toLowerCase() as VideoResolution | undefined) ?? null;
}

/** Seedance 模型即使经过 OpenAI 视频兼容路由，仍使用 Seedance 参数集。 */
export function usesSeedanceVideoParameters(
  modelKey: string,
  protocol: ProviderType | undefined,
): boolean {
  return protocol === "seedance-video" || modelKey.toLowerCase().includes("seedance");
}

/** 根据实际请求路由识别双模式能力；Routin 的通用 /videos 适配器目前只发送参考图角色。 */
export function supportsVideoImageInputMode(
  modelKey: string,
  protocol: ProviderType | undefined,
  builtinId?: string | null,
): boolean {
  return (
    protocol === "minimax-h3" ||
    protocol === "seedance-video" ||
    (protocol === "openai-video" &&
      builtinId !== "routin-ai" &&
      modelKey.toLowerCase().includes("seedance"))
  );
}

export function videoParameterOptions(
  modelKey: string,
  protocol: ProviderType | undefined,
): {
  resolutions: readonly VideoResolution[];
  durationMin: number;
} {
  if (protocol === "minimax-h3") {
    const maxModel = modelKey.toLowerCase() === "minimax-h3-max";
    return {
      resolutions: maxModel ? ["480p", "720p"] : ["720p", "1080p"],
      durationMin: maxModel ? 5 : 4,
    };
  }
  const fixed = fixedVideoResolution(modelKey);
  return {
    resolutions: fixed
      ? [fixed]
      : protocol === "xai-video"
        ? ["480p", "720p"]
        : ["480p", "720p", "1080p"],
    durationMin: 1,
  };
}

/** 保留已保存工作流的分辨率枚举，显示 H3 真正发送的原生档位。 */
export function videoResolutionLabel(
  value: VideoResolution,
  protocol: ProviderType | undefined,
): string {
  return protocol === "minimax-h3"
    ? { "480p": "480P", "720p": "768P", "1080p": "2K" }[value]
    : value;
}
