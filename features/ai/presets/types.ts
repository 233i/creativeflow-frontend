import type { ModelCategory, ProviderType } from "@/features/ai/types";

/**
 * 内置供应商模板。
 *
 * `version` 单调递增：提升版本表示预设有新默认值，需要应用到已持久化该预设的设备。
 * 模型升级仅添加缺失项，因此现有用户编辑仍具有最高优先级。
 */
export interface ProviderPreset {
  builtinId: string;
  version: number;
  name: string;
  description: string;
  type: ProviderType;
  defaultBaseUrl: string;
  homepage: string;
  apiKeyUrl?: string;
  requiresApiKey?: boolean;
  /** @lobehub/icons-static-svg 中的图标短名，默认为 `builtinId`。 */
  iconSlug?: string;
  defaultModels: PresetModel[];
}

export interface PresetModel {
  modelKey: string;
  name: string;
  category: ModelCategory;
  /** 首次包含此模型的预设版本，用于升级时只添加新默认项。 */
  introducedInVersion?: number;
  /** 协议覆盖；省略时继承供应商协议。 */
  type?: ProviderType;
  enabled?: boolean;
  contextLength?: number;
  maxOutputTokens?: number;
  supportsVision?: boolean;
  supportsFunctionCall?: boolean;
  supportsThinking?: boolean;
}
