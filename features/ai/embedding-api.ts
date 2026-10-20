import { createApiClient } from "@/lib/api-client";
import { AiApiError } from "@/features/ai/api";

/** 与后端独立的向量参数契约同步；不扩充旧模型 DTO。 */
export interface EmbeddingSettings {
  endpointPath: string;
  expectedDimensions: number | null;
  requestedDimensions: number | null;
  modelRevision: string;
  documentPrefix: string;
  queryPrefix: string;
  maxBatchSize: number;
  maxInputCharacters: number;
  timeoutSeconds: number;
  concurrency: number;
}

export interface EmbeddingConfiguration {
  settings: EmbeddingSettings;
  version: string | null;
}

/** 测试只返回摘要，向量数组和密钥留在后端。 */
export interface EmbeddingTestResult {
  ok: boolean;
  code: string | null;
  error: string | null;
  statusCode: number | null;
  dimensions: number | null;
  count: number;
  elapsedMilliseconds: number;
  configurationFingerprint: string | null;
  configurationVersion: string;
  totalTokens: number | null;
}

const request = createApiClient({
  baseUrl: "/api/v1",
  createError: ({ code, details, status, fallbackMessage }) =>
    new AiApiError(code || fallbackMessage, status, details),
});

export function getEmbeddingSettings(
  modelId: string,
  signal?: AbortSignal,
): Promise<EmbeddingConfiguration> {
  return request(`/admin/ai/models/${modelId}/embedding/settings`, { signal });
}

export function saveEmbeddingSettings(
  modelId: string,
  settings: EmbeddingSettings,
): Promise<EmbeddingConfiguration> {
  return request(`/admin/ai/models/${modelId}/embedding/settings`, {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export function testEmbeddingModel(
  modelId: string,
  inputs: string[],
  purpose: "document" | "query",
  signal?: AbortSignal,
): Promise<EmbeddingTestResult> {
  return request(`/admin/ai/models/${modelId}/embedding/test`, {
    method: "POST",
    body: JSON.stringify({ inputs, purpose }),
    signal,
  });
}
