import { z } from "zod";
import { findPreset } from "@/features/ai/presets";
import {
  MODEL_CATEGORIES,
  normalizeBaseUrl,
  PROVIDER_TYPES,
  type AiProvider,
  type ProviderType,
} from "@/features/ai/types";

/**
 * 仿照 LobeChat `?settings=` 的 URL 参数快速配置。
 *
 * 标准形式是在片段中放置 Base64URL 编码负载。为兼容已流通链接，仍接受查询形式和旧版 `base64:` 前缀。
 * 优先使用片段，因为它绝不会发送到服务器，API 密钥不会出现在请求行或服务器渲染的来源信息中。
 */

export const QUICK_CONFIG_PARAM = "settings";

const BASE64_PREFIX = "base64:";
const BASE64URL_PREFIX = "base64url:";
const MAX_CONFIG_BYTES = 512 * 1024;

const modelSchema = z.object({
  id: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200).optional(),
  category: z.enum(MODEL_CATEGORIES).default("chat"),
  type: z.enum(PROVIDER_TYPES).optional(),
  icon: z.string().trim().max(2048).optional(),
  contextLength: z.number().int().positive().max(100_000_000).optional(),
  maxOutputTokens: z.number().int().positive().max(10_000_000).optional(),
  supportsVision: z.boolean().optional(),
  supportsFunctionCall: z.boolean().optional(),
  supportsThinking: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

const providerSchema = z
  .object({
    builtinId: z.string().trim().min(1).max(64).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(1000).optional(),
    icon: z.string().trim().max(2048).optional(),
    presetVersion: z.number().int().positive().max(100_000).optional(),
    apiKey: z.string().trim().min(1).max(4096).optional(),
    baseUrl: z.string().trim().min(1).max(2048).optional(),
    type: z.enum(PROVIDER_TYPES).optional(),
    // 刻意设为可选：内置供应商可继承预设模型，自定义供应商也可能在用户决定启用哪些上游模型前导入。
    models: z.array(modelSchema).max(200).optional(),
  })
  .superRefine((provider, context) => {
    if (provider.builtinId === undefined) {
      if (provider.name === undefined) {
        context.addIssue({
          code: "custom",
          path: ["name"],
          message: "custom provider requires name",
        });
      }

      if (provider.type === undefined) {
        context.addIssue({
          code: "custom",
          path: ["type"],
          message: "custom provider requires type",
        });
      }

      if (provider.baseUrl === undefined) {
        context.addIssue({
          code: "custom",
          path: ["baseUrl"],
          message: "custom provider requires baseUrl",
        });
      }
    }
  });

export const quickConfigSchema = z.object({
  autoApply: z.boolean().default(false),
  providers: z.array(providerSchema).min(1).max(50),
});

export type QuickConfigInput = z.input<typeof quickConfigSchema>;
export type QuickConfig = z.infer<typeof quickConfigSchema>;
type QuickConfigProviderInput = z.input<typeof providerSchema>;
export type QuickConfigProvider = z.infer<typeof providerSchema>;

export interface ImportConfigModel {
  modelKey: string;
  name: string;
  type: ProviderType | null;
  category: (typeof MODEL_CATEGORIES)[number];
  icon: string | null;
  contextLength: number | null;
  maxOutputTokens: number | null;
  supportsVision: boolean;
  supportsFunctionCall: boolean;
  supportsThinking: boolean;
  enabled: boolean;
}

export interface ImportConfigProvider {
  builtinId: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  presetVersion: number | null;
  type: ProviderType;
  apiKey: string | null;
  baseUrl: string | null;
  models: ImportConfigModel[];
}

export interface ResolvedQuickConfig {
  autoApply: boolean;
  requiresConfirmation: boolean;
  providers: ImportConfigProvider[];
}

export type QuickConfigResult =
  | { ok: true; config: QuickConfig }
  | { ok: false; reason: "absent" }
  | { ok: false; reason: "malformed"; detail: string };

function byteString(bytes: Uint8Array): string {
  let result = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return result;
}

function decodeBase64(value: string, urlSafe: boolean): string {
  if (value.length > Math.ceil((MAX_CONFIG_BYTES * 4) / 3) + 16) {
    throw new Error("payload is too large");
  }

  // URLSearchParams 会把 `+` 视为空格。只对旧版标准 Base64 修复；
  // 标准 Base64URL 字母表不含这些字符，因此不存在歧义。
  let normalized = urlSafe ? value : value.replace(/ /g, "+");
  if (urlSafe) {
    normalized = normalized.replace(/-/g, "+").replace(/_/g, "/");
  }

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new Error("invalid base64 alphabet");
  }

  normalized = normalized.replace(/=+$/, "");
  normalized += "=".repeat((4 - (normalized.length % 4)) % 4);

  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  if (bytes.byteLength > MAX_CONFIG_BYTES) {
    throw new Error("payload is too large");
  }

  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function validateBaseUrl(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:")
      return "baseUrl must use HTTP or HTTPS";
    if (!url.hostname) return "baseUrl must include a host";
    if (url.username || url.password) return "baseUrl must not include credentials";
    if (url.search || url.hash) return "baseUrl must not include a query or fragment";
    return null;
  } catch {
    return "baseUrl must be an absolute HTTP(S) URL";
  }
}

function validateConfig(config: QuickConfig): string | null {
  for (const provider of config.providers) {
    if (provider.builtinId !== undefined && !findPreset(provider.builtinId)) {
      return `unknown builtin provider '${provider.builtinId}'`;
    }

    if (provider.baseUrl) {
      const error = validateBaseUrl(provider.baseUrl);
      if (error) return error;
    }

    for (const model of provider.models ?? []) {
      if (model.type && model.category === "chat") {
        // 后端仍是最终权威，但在此拒绝空或无效的模型协议数据，
        // 可让预览在任何秘密发送到 API 前失败。
        if (!PROVIDER_TYPES.includes(model.type)) return `unknown model protocol '${model.type}'`;
      }
    }
  }

  return null;
}

/** 从查询字符串中解析快速配置参数。 */
export function parseQuickConfig(search: string | URLSearchParams): QuickConfigResult {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  return parseRaw(params.get(QUICK_CONFIG_PARAM));
}

/**
 * 从查询字符串或片段读取配置。格式错误的片段仍优先于有效查询，
 * 防止损坏的标准链接被无关参数静默替换。
 */
export function parseQuickConfigFromLocation(location: {
  search: string;
  hash: string;
}): QuickConfigResult {
  const hash = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
  const fromHash = parseRaw(new URLSearchParams(hash).get(QUICK_CONFIG_PARAM));

  return fromHash.ok || (!fromHash.ok && fromHash.reason !== "absent")
    ? fromHash
    : parseQuickConfig(location.search);
}

function parseRaw(raw: string | null): QuickConfigResult {
  if (raw === null || raw.trim() === "") {
    return { ok: false, reason: "absent" };
  }

  let json: string;
  try {
    if (raw.startsWith(BASE64URL_PREFIX)) {
      json = decodeBase64(raw.slice(BASE64URL_PREFIX.length), true);
    } else if (raw.startsWith(BASE64_PREFIX)) {
      json = decodeBase64(raw.slice(BASE64_PREFIX.length), false);
    } else {
      if (new TextEncoder().encode(raw).byteLength > MAX_CONFIG_BYTES) {
        return { ok: false, reason: "malformed", detail: "payload is too large" };
      }
      json = raw;
    }
  } catch (error) {
    return {
      ok: false,
      reason: "malformed",
      detail: error instanceof Error ? error.message : "base64 decode failed",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: "malformed", detail: "invalid JSON" };
  }

  const result = quickConfigSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      reason: "malformed",
      detail: result.error.issues[0]?.message ?? "schema mismatch",
    };
  }

  const validationError = validateConfig(result.data);
  if (validationError) {
    return { ok: false, reason: "malformed", detail: validationError };
  }

  return { ok: true, config: result.data };
}

function findExistingProvider(
  provider: QuickConfigProvider | QuickConfigProviderInput,
  existingProviders: readonly AiProvider[],
): AiProvider | undefined {
  if (provider.builtinId) {
    return existingProviders.find((candidate) => candidate.builtinId === provider.builtinId);
  }

  const name = provider.name?.trim().toLowerCase();
  return name
    ? existingProviders.find((candidate) => candidate.name.trim().toLowerCase() === name)
    : undefined;
}

function presetModels(preset: NonNullable<ReturnType<typeof findPreset>>): ImportConfigModel[] {
  return preset.defaultModels.map((model) => ({
    modelKey: model.modelKey,
    name: model.name,
    type: model.type ?? null,
    category: model.category,
    icon: null,
    contextLength: model.contextLength ?? null,
    maxOutputTokens: model.maxOutputTokens ?? null,
    supportsVision: model.supportsVision ?? false,
    supportsFunctionCall: model.supportsFunctionCall ?? false,
    supportsThinking: model.supportsThinking ?? false,
    enabled: model.enabled ?? true,
  }));
}

/**
 * 将 URL 条目解析为 API 接受的规范化负载。
 *
 * 预设值只填充省略字段。解析时会参考现有供应商，使只包含 `builtinId` 和 `apiKey` 的最小内置链接
 * 不会重置用户的自定义代理 URL。链接省略 `models` 时会发送默认预设模型；
 * API 只插入缺失项，因此现有单模型编辑保持不变。
 */
export function resolveQuickConfig(
  config: QuickConfig | QuickConfigInput,
  existingProviders: readonly AiProvider[] = [],
): ResolvedQuickConfig {
  const providers = config.providers.map((provider) => {
    const preset = findPreset(provider.builtinId);
    const existing = findExistingProvider(provider, existingProviders);
    const type = provider.type ?? existing?.type ?? preset?.type ?? "openai-chat";
    const name = provider.name ?? existing?.name ?? preset?.name ?? provider.builtinId ?? "";
    const baseUrl = provider.baseUrl ?? existing?.baseUrl ?? preset?.defaultBaseUrl ?? null;
    const models = provider.models ?? (preset ? presetModels(preset) : []);

    return {
      builtinId: provider.builtinId ?? existing?.builtinId ?? null,
      name,
      description: provider.description ?? existing?.description ?? preset?.description ?? null,
      icon: provider.icon ?? existing?.icon ?? null,
      presetVersion: provider.presetVersion ?? preset?.version ?? existing?.presetVersion ?? null,
      type,
      apiKey: provider.apiKey ?? null,
      baseUrl: baseUrl ? normalizeBaseUrl(baseUrl, type) : null,
      models: models.map((model) => {
        const modelKey = "id" in model ? model.id : model.modelKey;

        return {
          modelKey,
          name: model.name ?? modelKey,
          type: model.type ?? null,
          category: model.category ?? "chat",
          icon: model.icon ?? null,
          contextLength: model.contextLength ?? null,
          maxOutputTokens: model.maxOutputTokens ?? null,
          supportsVision: model.supportsVision ?? false,
          supportsFunctionCall: model.supportsFunctionCall ?? false,
          supportsThinking: model.supportsThinking ?? false,
          enabled: model.enabled ?? true,
        };
      }),
    } satisfies ImportConfigProvider;
  });

  return {
    autoApply: config.autoApply ?? false,
    requiresConfirmation: providers.some((provider) => provider.apiKey !== null),
    providers,
  };
}

/** 遮盖密钥以供显示。绝不能渲染完整值，因为对话框可能被截图。 */
export function maskApiKey(apiKey: string | undefined): string {
  if (!apiKey) return "";
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) return "••••";
  return `${trimmed.slice(0, 3)}••••${trimmed.slice(-4)}`;
}

/**
 * 供已持有单个供应商条目的调用方使用的向后兼容辅助函数。
 * 完整链接应优先使用 `resolveQuickConfig`，因为它还处理现有供应商身份和预设模型默认值。
 */
export function toImportPayload(
  provider: QuickConfigProvider | QuickConfigProviderInput,
  fallbackType: ProviderType,
  existingProviders: readonly AiProvider[] = [],
): ImportConfigProvider {
  const type = provider.type ?? findPreset(provider.builtinId)?.type ?? fallbackType;
  const input = provider.type === undefined ? { ...provider, type } : provider;
  const resolved = resolveQuickConfig({ autoApply: false, providers: [input] }, existingProviders)
    .providers[0];

  return {
    ...resolved,
    type: resolved.type,
  };
}

/** 从 URL 中移除该参数，同时保留无关的查询和片段参数。 */
export function urlWithoutQuickConfig(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete(QUICK_CONFIG_PARAM);

  const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
  if (hash) {
    const hashParams = new URLSearchParams(hash);
    hashParams.delete(QUICK_CONFIG_PARAM);
    const rest = hashParams.toString();
    parsed.hash = rest ? `#${rest}` : "";
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function encodeBase64Url(bytes: Uint8Array): string {
  return btoa(byteString(bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 构建标准分享链接，并在片段中放置 Base64URL 负载。 */
export function buildShareLink(
  origin: string,
  path: string,
  config: QuickConfig | QuickConfigInput,
): string {
  const json = JSON.stringify(config);
  const bytes = new TextEncoder().encode(json);
  if (bytes.byteLength > MAX_CONFIG_BYTES) {
    throw new Error("configuration payload is too large");
  }

  return `${origin}${path}#${QUICK_CONFIG_PARAM}=${BASE64URL_PREFIX}${encodeBase64Url(bytes)}`;
}
