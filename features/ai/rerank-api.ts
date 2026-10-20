import { createApiClient } from "@/lib/api-client";
import { AiApiError } from "./api";
export interface RerankSettings {
  endpointPath: string;
  modelRevision: string;
  maxDocuments: number;
  maxDocumentCharacters: number;
  maxQueryCharacters: number;
  timeoutSeconds: number;
  concurrency: number;
}
export interface RerankConfiguration {
  settings: RerankSettings;
  version: string | null;
}
export interface RerankTestResult {
  ok: boolean;
  code: string | null;
  error: string | null;
  statusCode: number | null;
  results: { index: number; score: number }[];
  elapsedMilliseconds: number;
  configurationVersion: string;
  totalTokens: number | null;
}
const request = createApiClient({
  baseUrl: "/api/v1/admin/ai/models",
  createError: ({ code, details, status, fallbackMessage }) =>
    new AiApiError(code || fallbackMessage, status, details),
});
export const rerankApi = {
  settings: (id: string, signal?: AbortSignal) =>
    request<RerankConfiguration>(`/${encodeURIComponent(id)}/rerank/settings`, { signal }),
  save: (id: string, settings: RerankSettings) =>
    request<RerankConfiguration>(`/${encodeURIComponent(id)}/rerank/settings`, {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
  test: (id: string, query: string, documents: string[], signal?: AbortSignal) =>
    request<RerankTestResult>(`/${encodeURIComponent(id)}/rerank/test`, {
      method: "POST",
      body: JSON.stringify({ query, documents }),
      signal,
    }),
};
