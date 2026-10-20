import { createApiClient } from "@/lib/api-client";
import type { RetrievalSettings, RetrievalTrace } from "./retrieval-types";

export interface KnowledgeLibrary {
  id: string;
  name: string;
  description: string;
  modelId: string;
  enabled: boolean;
  activeVersion: string | null;
}
export interface KnowledgeVersion {
  id: string;
  status:
    | "queued"
    | "embedding"
    | "writing"
    | "ready"
    | "failed"
    | "unknown"
    | "cleaning"
    | "cleanup_failed"
    | "deleted";
  error: string | null;
  documentCount: number;
  chunkCount: number;
  embeddedCount: number;
  createdAt: string;
  writtenCount?: number;
  reusedCount?: number;
  sourceVersionId?: string | null;
  chunkSize?: number | null;
  overlap?: number | null;
  reservedBytes?: number;
  number?: number;
  parserVersion?: string;
  indexSchema?: "dense-v1" | "hybrid-v1";
}
export interface KnowledgeDetail {
  library: KnowledgeLibrary;
  versions: KnowledgeVersion[];
}
export interface KnowledgeDocument {
  name: string;
  text: string;
}
export interface KnowledgeChunk {
  id: string;
  document: string;
  startLine: number;
  endLine: number;
  text: string;
  startOffset?: number;
  endOffset?: number;
  sectionPath?: string;
  blockType?: string;
  continuation?: boolean;
}
export interface KnowledgePreview {
  digest: string;
  chunks: KnowledgeChunk[];
  documentCount: number;
}
export interface KnowledgeSearch {
  versionId: string;
  hits: {
    chunk: KnowledgeChunk;
    score: number;
    scoreType?: string;
    role?: "primary" | "supporting";
  }[];
  trace?: RetrievalTrace | null;
  maxContextChunks?: number;
  omittedCount?: number;
  truncated?: boolean;
}
export interface EvaluationCase {
  query: string;
  relevantChunkIds: string[];
}
export interface EvaluationResult {
  versionId: string;
  metrics: {
    strategy: string;
    recall: number;
    mrr: number;
    ndcg: number;
    elapsedMilliseconds: number;
    results: KnowledgeSearch[];
  }[];
}
export interface ImportInput {
  documents: KnowledgeDocument[];
  chunkSize: number;
  overlap: number;
  previewDigest?: string;
}
export interface KnowledgeQuotas {
  maxLibraries: number;
  maxVersions: number;
  maxDocuments: number;
  maxDocumentBytes: number;
  maxVersionBytes: number;
  maxChunks: number;
  maxLibraryReservedBytes: number;
}
export const pilotQuotas: KnowledgeQuotas = {
  maxLibraries: 10,
  maxVersions: 10,
  maxDocuments: 8,
  maxDocumentBytes: 65536,
  maxVersionBytes: 65536,
  maxChunks: 128,
  maxLibraryReservedBytes: 67108864,
};
export interface KnowledgeCapabilities {
  enabled: boolean;
  indexAvailable: boolean;
  quotas?: KnowledgeQuotas;
}
export interface KnowledgeDocumentSummary {
  id: string;
  name: string;
  byteCount: number;
  chunkCount: number;
}
export interface DocumentChange {
  action: "add" | "replace" | "remove";
  name: string;
  documentId?: string;
  text?: string;
}
export interface DocumentChanges {
  sourceVersionId: string;
  changes: DocumentChange[];
  chunkSize: number;
  overlap: number;
  previewDigest?: string;
}
export interface CleanupPreview {
  allowed: boolean;
  reason: string | null;
  referenceCount: number;
  reservedBytes: number;
}

const request = createApiClient({
  baseUrl: "/api/v1/admin/knowledge-bases",
  createError: ({ details, fallbackMessage }) => new Error(details.join("；") || fallbackMessage),
});

export const knowledgeApi = {
  capabilities: () => request<KnowledgeCapabilities>("/capabilities"),
  list: () => request<KnowledgeLibrary[]>(""),
  create: (value: { name: string; description: string; modelId: string }) =>
    request<KnowledgeLibrary>("", { method: "POST", body: JSON.stringify(value) }),
  detail: (id: string) => request<KnowledgeDetail>(`/${encodeURIComponent(id)}`),
  preview: (value: ImportInput) =>
    request<KnowledgePreview>("/preview", { method: "POST", body: JSON.stringify(value) }),
  import: (id: string, value: ImportInput) =>
    request<KnowledgeVersion>(`/${encodeURIComponent(id)}/versions`, {
      method: "POST",
      body: JSON.stringify(value),
    }),
  chunks: (id: string, version: string, documentId?: string, offset = 0) =>
    request<KnowledgeChunk[]>(
      `/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/chunks?offset=${offset}&limit=128${documentId ? `&documentId=${encodeURIComponent(documentId)}` : ""}`,
    ),
  documents: (id: string, version: string) =>
    request<KnowledgeDocumentSummary[]>(
      `/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/documents`,
    ),
  document: (id: string, version: string, document: string) =>
    request<KnowledgeDocument>(
      `/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/documents/${encodeURIComponent(document)}`,
    ),
  previewChanges: (id: string, value: DocumentChanges) =>
    request<KnowledgePreview>(`/${encodeURIComponent(id)}/document-changes/preview`, {
      method: "POST",
      body: JSON.stringify(value),
    }),
  changeDocuments: (id: string, value: DocumentChanges) =>
    request<KnowledgeVersion>(`/${encodeURIComponent(id)}/document-changes`, {
      method: "POST",
      body: JSON.stringify(value),
    }),
  cleanupPreview: (id: string, version: string) =>
    request<CleanupPreview>(
      `/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/cleanup`,
    ),
  cleanup: (id: string, version: string, reason: string) =>
    request<void>(`/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/cleanup`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  activate: (id: string, version: string) =>
    request<void>(`/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/activate`, {
      method: "POST",
    }),
  rebuild: (id: string, version: string) =>
    request<KnowledgeVersion>(
      `/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/rebuild`,
      { method: "POST" },
    ),
  recover: (id: string, version: string, action: "continue" | "reembedUnknown") =>
    request<void>(`/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/recover`, {
      method: "POST",
      body: JSON.stringify({ action }),
    }),
  enabled: (id: string, enabled: boolean) =>
    request<void>(`/${encodeURIComponent(id)}/enabled`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }),
  search: (
    id: string,
    query: string,
    topK: number,
    settings?: RetrievalSettings,
    originalQuestion?: string,
  ) =>
    request<KnowledgeSearch>(`/${encodeURIComponent(id)}/search`, {
      method: "POST",
      body: JSON.stringify({ query, topK, settings, originalQuestion }),
    }),
  evaluate: (
    id: string,
    cases: EvaluationCase[],
    settings: RetrievalSettings,
    includeRerank: boolean,
  ) =>
    request<EvaluationResult>(`/${encodeURIComponent(id)}/evaluate`, {
      method: "POST",
      body: JSON.stringify({ cases, settings, includeRerank }),
    }),
};

/** 客户端先限制读取大小并严格 UTF-8 解码，服务端仍独立校验，不相信扩展名。 */
export async function readKnowledgeFiles(
  files: File[],
  quotas = pilotQuotas,
): Promise<KnowledgeDocument[]> {
  if (
    files.length < 1 ||
    files.length > quotas.maxDocuments ||
    files.some((file) => file.size > quotas.maxDocumentBytes) ||
    files.reduce((total, file) => total + file.size, 0) > quotas.maxVersionBytes
  )
    throw new Error(
      `请选择 1–${quotas.maxDocuments} 份文档，单篇不超过 ${quotas.maxDocumentBytes / 1024} KiB，合计不超过 ${quotas.maxVersionBytes / 1024} KiB。`,
    );
  const names = new Set<string>();
  return Promise.all(
    files.map(async (file) => {
      if (!/\.(txt|md)$/i.test(file.name) || names.has(file.name.toLowerCase()))
        throw new Error("仅支持名称不重复的 TXT／MD 文件。");
      names.add(file.name.toLowerCase());
      try {
        return {
          name: file.name,
          text: new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()),
        };
      } catch {
        throw new Error(`${file.name} 不是有效的 UTF-8 文本。`);
      }
    }),
  );
}
