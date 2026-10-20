import { createApiClient } from "@/lib/api-client";
import type { AiModel, AiProvider, ModelCategory, ProviderType } from "@/features/ai/types";

/**
 * AI 配置 API 的浏览器端客户端。
 *
 * 这些函数在浏览器而非服务器中运行，因此调用 Next.js 重写（`/api/*` → .NET API），
 * 并通过公共传输层设置 `credentials: "include"`：
 * 普通读取使用账户会话，配置修改使用独立管理员会话。
 */

const BASE = "/api/v1";

export class AiApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = "AiApiError";
  }

  /** 此端点所需的账户、设备或管理员会话不可用。 */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

const request = createApiClient({
  baseUrl: BASE,
  createError: ({ code, details, status, fallbackMessage }) =>
    new AiApiError(code || fallbackMessage, status, details),
});

// --- 供应商 ---

export interface CreateProviderInput {
  builtinId?: string | null;
  name: string;
  description?: string | null;
  icon?: string | null;
  type: ProviderType;
  baseUrl: string;
  apiKey?: string;
  enabled?: boolean;
  presetVersion?: number;
  models?: CreateModelInput[];
}

export interface CreateModelInput {
  modelKey: string;
  name?: string;
  type?: ProviderType | null;
  category?: ModelCategory;
  icon?: string | null;
  contextLength?: number | null;
  maxOutputTokens?: number | null;
  supportsVision?: boolean;
  supportsFunctionCall?: boolean;
  supportsThinking?: boolean;
  enabled?: boolean;
}

/**
 * 供应商的部分更新。
 *
 * `apiKey` 与服务器一致，有三种状态：省略时保留已存储密钥（编辑基础 URL 时最常见），
 * 传 `""` 时清除，传其他值时替换。`null` 经过 JSON 往返后与省略无法区分，因此不允许使用。
 */
export interface UpdateProviderInput {
  name?: string;
  description?: string | null;
  icon?: string | null;
  type?: ProviderType;
  baseUrl?: string;
  apiKey?: string;
  enabled?: boolean;
}

export function listProviders(): Promise<{ providers: AiProvider[] }> {
  return request("/ai/providers");
}

export function listAdminProviders(): Promise<{ providers: AiProvider[] }> {
  return request("/admin/ai/providers");
}

export function createProvider(input: CreateProviderInput): Promise<AiProvider> {
  return request("/admin/ai/providers", { method: "POST", body: JSON.stringify(input) });
}

export function updateProvider(id: string, input: UpdateProviderInput): Promise<AiProvider> {
  return request(`/admin/ai/providers/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteProvider(id: string): Promise<void> {
  return request(`/admin/ai/providers/${id}`, { method: "DELETE" });
}

export interface ProviderCheckResult {
  ok: boolean;
  statusCode: number | null;
  error: string | null;
  modelCount: number | null;
}

export function checkProvider(id: string): Promise<ProviderCheckResult> {
  return request(`/admin/ai/providers/${id}/check`, { method: "POST" });
}

export interface DiscoveredModel {
  modelKey: string;
  name: string;
  category: ModelCategory;
  icon: string | null;
}

/** 查询供应商自身目录，不持久化任何内容。 */
export function fetchUpstreamModels(id: string): Promise<{ models: DiscoveredModel[] }> {
  return request(`/admin/ai/providers/${id}/upstream-models`);
}

/** 添加模型并跳过供应商已有项，可安全重复执行。 */
export function importModels(id: string, models: CreateModelInput[]): Promise<{ added: number }> {
  return request(`/admin/ai/providers/${id}/models/import`, {
    method: "POST",
    body: JSON.stringify({ models }),
  });
}

// --- 模型 ---

export function addModel(providerId: string, input: CreateModelInput): Promise<AiModel> {
  return request(`/admin/ai/providers/${providerId}/models`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface UpdateModelInput {
  name?: string;
  /** `""` 清除覆盖，使模型重新跟随其供应商协议。 */
  type?: ProviderType | "";
  category?: ModelCategory;
  icon?: string | null;
  contextLength?: number | null;
  maxOutputTokens?: number | null;
  supportsVision?: boolean;
  supportsFunctionCall?: boolean;
  supportsThinking?: boolean;
  enabled?: boolean;
}

export function updateModel(modelId: string, input: UpdateModelInput): Promise<AiModel> {
  return request(`/admin/ai/models/${modelId}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteModel(modelId: string): Promise<void> {
  return request(`/admin/ai/models/${modelId}`, { method: "DELETE" });
}

// --- 应用级模型角色 ---

export type ModelSlotKind = "chat" | "fast" | "image" | "video";

export interface ModelSlotResponse {
  kind: ModelSlotKind;
  providerId: string | null;
  modelId: string | null;
  updatedAt: string;
}

export function listModelSlots(): Promise<{ slots: ModelSlotResponse[] }> {
  return request("/ai/model-slots");
}

export function listAdminModelSlots(): Promise<{ slots: ModelSlotResponse[] }> {
  return request("/admin/ai/model-slots");
}

export function updateModelSlot(
  kind: ModelSlotKind,
  slot: { providerId: string | null; modelId: string | null },
): Promise<ModelSlotResponse> {
  return request(`/admin/ai/model-slots/${kind}`, {
    method: "PUT",
    body: JSON.stringify(slot),
  });
}

// --- 应用级图片生成策略 ---

export type ImageResponseFormat = "url" | "base64";

export interface ImageGenerationSettings {
  responseFormat: ImageResponseFormat;
  updatedAt: string;
}

export function getImageGenerationSettings(): Promise<ImageGenerationSettings> {
  return request("/admin/ai/image-generation-settings");
}

export function updateImageGenerationSettings(
  responseFormat: ImageResponseFormat,
): Promise<ImageGenerationSettings> {
  return request("/admin/ai/image-generation-settings", {
    method: "PUT",
    body: JSON.stringify({ responseFormat }),
  });
}

// --- MCP 配置 ---

export type McpTransport = "stdio" | "sse" | "streamable-http";

export interface McpEnvEntry {
  key: string;
  value: string;
}

export interface McpSecretEntry {
  key: string;
  isConfigured: boolean;
  hint: string;
}

export interface McpServer {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  transport: McpTransport;
  command: string | null;
  args: string[];
  env: McpSecretEntry[];
  cwd: string | null;
  url: string | null;
  headers: McpSecretEntry[];
  autoFallback: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMcpServerInput {
  name: string;
  description?: string | null;
  transport: McpTransport;
  command?: string | null;
  args?: string[];
  env?: McpEnvEntry[];
  cwd?: string | null;
  url?: string | null;
  headers?: McpEnvEntry[];
  autoFallback?: boolean;
  enabled?: boolean;
}

export function listMcpServers(): Promise<{ servers: McpServer[] }> {
  return request("/mcp/servers");
}

export function createMcpServer(input: CreateMcpServerInput): Promise<McpServer> {
  return request("/mcp/servers", { method: "POST", body: JSON.stringify(input) });
}

export function updateMcpServer(
  id: string,
  input: Partial<CreateMcpServerInput>,
): Promise<McpServer> {
  return request(`/mcp/servers/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteMcpServer(id: string): Promise<void> {
  return request(`/mcp/servers/${id}`, { method: "DELETE" });
}

export interface McpCheckResult {
  ok: boolean;
  error: string | null;
  toolCount: number;
}

export function checkMcpServer(id: string): Promise<McpCheckResult> {
  return request(`/mcp/servers/${id}/check`, { method: "POST" });
}

export interface McpToolSummary {
  name: string;
  description: string;
  inputSchemaJson: string;
}

export function listMcpTools(id: string): Promise<{ tools: McpToolSummary[] }> {
  return request(`/mcp/servers/${id}/tools`);
}

export function importMcpServers(servers: CreateMcpServerInput[]): Promise<{ added: number }> {
  return request("/mcp/servers/import", {
    method: "POST",
    body: JSON.stringify({ servers }),
  });
}

// --- URL 快速配置 ---

export interface ImportConfigPayload {
  providers: Array<{
    builtinId: string | null;
    name: string;
    description: string | null;
    icon: string | null;
    presetVersion: number | null;
    type: ProviderType;
    apiKey: string | null;
    baseUrl: string | null;
    models: CreateModelInput[];
  }>;
}

export function importConfig(
  payload: ImportConfigPayload,
): Promise<{ created: number; updated: number }> {
  return request("/admin/ai/config/import", { method: "POST", body: JSON.stringify(payload) });
}

// --- 画布素材 ---

export interface UploadedAsset {
  url: string;
  mediaType: string;
  assetId: string;
}

/**
 * 上传图片并返回画布应存储的 URL。
 *
 * 对象 URL 不能替代此功能。它会随文档销毁，因此持有它的节点在重新加载后会失效；
 * 生成端点只解析 `/api/v1/canvas/assets/` URL，未上传图片作为参考时会被静默忽略。
 */
export async function uploadAsset(file: File, signal?: AbortSignal): Promise<UploadedAsset> {
  const form = new FormData();
  form.append("file", file);

  // 不设置 Content-Type 请求头：必须由浏览器设置，才能包含多部分边界。
  const response = await fetch(`${BASE}/canvas/assets`, {
    method: "POST",
    credentials: "include",
    body: form,
    signal,
  });

  if (!response.ok) {
    let detail = `Upload failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string; details?: string[] };
      detail = body.details?.[0] ?? body.error ?? detail;
    } catch {
      // 保留根据状态码生成的消息。
    }
    throw new AiApiError(detail, response.status);
  }

  return (await response.json()) as UploadedAsset;
}

/** 提取或复用已存储视频素材的缓存末帧。 */
export function extractVideoLastFrame(assetUrl: string): Promise<UploadedAsset> {
  const match = /^\/api\/v1\/canvas\/assets\/([0-9a-f-]{36})(?:[/?#]|$)/i.exec(assetUrl);
  if (!match) {
    throw new AiApiError("The video is not a stored CreativeFlow asset", 400);
  }

  return request(`/canvas/assets/${match[1]}/last-frame`, { method: "POST" });
}
