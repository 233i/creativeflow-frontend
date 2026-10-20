/**
 * AI 供应商和模型类型。
 *
 * 从 OpenCowork 移植，并移除仅适用于 Electron 的关注点（OAuth 设备流程、系统代理、TLS 绕过）；
 * 浏览器客户端与自有后端通信时不需要这些功能。
 *
 * 保留的核心设计：模型可携带自己的 `type`，未设置时回退到供应商协议。
 * 因此同一聚合供应商可提供使用三种不同传输协议的模型。下方 `resolveProtocol` 是此规则的唯一位置，
 * 后端也实现完全相同的规则。
 */

/** 传输协议。决定请求如何构建，而不是由谁提供服务。 */
export const PROVIDER_TYPES = [
  "openai-chat",
  "openai-embeddings",
  "rerank",
  "openai-responses",
  "anthropic",
  "gemini",
  "openai-images",
  "openai-video",
  "minimax-video",
  "minimax-h3",
  "seedance-video",
  "xai-video",
] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const MODEL_CATEGORIES = [
  "chat",
  "image",
  "video",
  "embedding",
  "rerank",
  "speech",
] as const;

export type ModelCategory = (typeof MODEL_CATEGORIES)[number];

/** 各协议可服务的分类，用于验证模型协议覆盖。 */
export const PROTOCOLS_BY_CATEGORY: Record<ModelCategory, readonly ProviderType[]> = {
  chat: ["openai-chat", "openai-responses", "anthropic", "gemini"],
  image: ["openai-images", "gemini"],
  video: ["openai-video", "minimax-video", "minimax-h3", "seedance-video", "xai-video"],
  embedding: ["openai-embeddings"],
  rerank: ["rerank"],
  speech: ["openai-chat"],
};

export interface AiModel {
  id: string;
  /** 发送给上游的标识符，例如 `gpt-image-1`，不同于数据行标识。 */
  modelKey: string;
  name: string;
  enabled: boolean;
  /** 协议覆盖。未设置时回退到供应商的 `type`。 */
  type?: ProviderType | null;
  category: ModelCategory;
  /** 图标短名；未设置时根据 `modelKey` 推断。 */
  icon?: string | null;
  contextLength?: number | null;
  maxOutputTokens?: number | null;
  supportsVision?: boolean;
  supportsFunctionCall?: boolean;
  supportsThinking?: boolean;
}

export interface AiProvider {
  id: string;
  /** 供应商来自内置预设时设置；用户自定义供应商为空。 */
  builtinId?: string | null;
  /** 使用预设时，提供此供应商的预设版本。 */
  presetVersion?: number | null;
  name: string;
  description?: string | null;
  /** 用户提供的图标（数据 URL），未提供时回退到预设徽标。 */
  icon?: string | null;
  type: ProviderType;
  baseUrl: string;
  enabled: boolean;
  /**
   * 是否已存储密钥。密钥本身绝不会发送到浏览器；服务器加密保存，并在代理请求时注入。
   */
  hasApiKey: boolean;
  /** 已存储密钥的末四个字符，仅用于识别。 */
  apiKeyHint?: string | null;
  models: AiModel[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 解析供应商和模型组合所使用的协议。
 *
 * 已经按媒体协议声明的供应商会被真正继承。供应商按聊天协议声明时，
 * 图片和视频模型才分别使用 `openai-images` 与 `seedance-video` 默认值。
 */
export function resolveProtocol(
  provider: Pick<AiProvider, "type">,
  model: Pick<AiModel, "type" | "category"> | undefined,
): ProviderType {
  if (!model) return provider.type;
  if (model.type) return model.type;
  if (model.category === "rerank") return "rerank";

  if (model.category === "image") {
    if (provider.type === "openai-images" || provider.type === "gemini") return provider.type;
    return "openai-images";
  }

  if (model.category === "video") {
    if (PROTOCOLS_BY_CATEGORY.video.includes(provider.type)) return provider.type;
    return "seedance-video";
  }

  return provider.type;
}

/**
 * 移除协议客户端会自行重新追加的供应商特有后缀。
 *
 * 用户通常粘贴供应商文档展示的地址，而该地址一般是兼容 OpenAI 的 URL。
 * 若不处理，Anthropic 基础 URL `https://api.anthropic.com/v1` 会变成
 * `https://api.anthropic.com/v1/v1/messages`。
 */
export function normalizeBaseUrl(baseUrl: string, protocol: ProviderType): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");

  if (protocol === "anthropic") {
    return trimmed.replace(/\/v1(?:\/messages)?$/i, "");
  }

  if (protocol === "gemini") {
    return trimmed.replace(/\/openai$/i, "");
  }

  if (protocol === "minimax-h3") {
    return trimmed.replace(/\/video_generation$/i, "").replace(/\/v[12]$/i, "");
  }

  return trimmed;
}

/** 全局模型目录的去重键：通过两个供应商访问的同一模型只算一个条目。 */
export function normalizeModelKey(modelKey: string): string {
  return modelKey.trim().toLowerCase();
}

export function enabledModels(provider: AiProvider, category?: ModelCategory): AiModel[] {
  return provider.models.filter(
    (model) => model.enabled && (category === undefined || model.category === category),
  );
}

/** 供应商启用且已持有密钥或不需要密钥时可用。 */
export function isProviderReady(provider: AiProvider, requiresApiKey: boolean): boolean {
  return provider.enabled && (provider.hasApiKey || !requiresApiKey);
}
