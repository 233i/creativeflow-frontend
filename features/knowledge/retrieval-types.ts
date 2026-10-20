/** 管理测试与检索节点共同采用的策略，不携带端点和凭据。 */
export interface RetrievalSettings {
  mode: "vector" | "keyword" | "hybrid";
  denseCandidates: number;
  keywordCandidates: number;
  rerankCandidates: number;
  topK: number;
  maxContextChunks: number;
  minVectorScore: number;
  minRerankScore: number | null;
  neighborRadius: number;
  exactMatch: "prefer" | "require" | "off";
  rerankModelId: string | null;
  rerankFailurePolicy: "fail" | "fallback";
}
export const defaultRetrievalSettings: RetrievalSettings = {
  mode: "hybrid",
  denseCandidates: 32,
  keywordCandidates: 32,
  rerankCandidates: 24,
  topK: 4,
  maxContextChunks: 8,
  minVectorScore: 0,
  minRerankScore: null,
  neighborRadius: 1,
  exactMatch: "prefer",
  rerankModelId: null,
  rerankFailurePolicy: "fail",
};
export interface CandidateTrace {
  id: string;
  denseRank: number | null;
  keywordRank: number | null;
  fusionRank: number | null;
  rerankRank: number | null;
  denseScore: number | null;
  keywordScore: number | null;
  fusionScore: number | null;
  rerankScore: number | null;
  exactMatched: boolean;
  selected: boolean;
  reason: string;
}
export interface RetrievalTrace {
  mode: string;
  query: string;
  originalQuestion: string | null;
  denseCount: number;
  keywordCount: number;
  exactCount: number;
  fusedCount: number;
  rerankedCount: number;
  deliveredCount: number;
  rerankStatus: string;
  rerankError: string | null;
  rerankModelId: string | null;
  rerankConfigurationVersion: string | null;
  rerankTokens: number | null;
  embeddingMilliseconds: number;
  recallMilliseconds: number;
  rerankMilliseconds: number;
  totalMilliseconds: number;
  candidates: CandidateTrace[];
}
/** 两端同样的有界检查，防止浮点数、空值或超大候选在按钮提交前被忽略。 */
export function retrievalError(value: RetrievalSettings, hybridAvailable = true): string | null {
  const integer = (n: number, min: number, max: number) =>
    Number.isInteger(n) && n >= min && n <= max;
  if (!hybridAvailable && (value.mode !== "vector" || value.exactMatch === "require"))
    return "该版本只有向量索引，请先重建混合索引并明确选择新版本。";
  if (!integer(value.topK, 1, 32)) return "主命中数 TopK 必须是 1–32 的整数。";
  if (!integer(value.maxContextChunks, 1, 32)) return "最终交付片段数必须是 1–32 的整数。";
  if (
    ![value.denseCandidates, value.keywordCandidates, value.rerankCandidates].every((n) =>
      integer(n, 1, 64),
    )
  )
    return "候选数量必须为 1–64 的整数。";
  const candidateError = candidateLimitsError(value);
  if (candidateError) return candidateError;
  if (!integer(value.neighborRadius, 0, 2)) return "相邻补充范围应为 0–2。";
  return scoreLimitsError(value);
}
function candidateLimitsError(value: RetrievalSettings): string | null {
  const routes = [
    { enabled: value.mode !== "keyword", count: value.denseCandidates },
    { enabled: value.mode !== "vector", count: value.keywordCandidates },
    { enabled: Boolean(value.rerankModelId), count: value.rerankCandidates },
  ];
  return routes.some((route) => route.enabled && route.count < value.topK)
    ? "启用的召回与重排候选数不能少于主命中数。"
    : null;
}
function scoreLimitsError(value: RetrievalSettings): string | null {
  if (
    !Number.isFinite(value.minVectorScore) ||
    value.minVectorScore < -1 ||
    value.minVectorScore > 1
  )
    return "向量阈值应为 -1–1。";
  if (
    value.minRerankScore !== null &&
    (!value.rerankModelId ||
      !Number.isFinite(value.minRerankScore) ||
      value.minRerankScore < 0 ||
      value.minRerankScore > 1)
  )
    return "重排序阈值需要已选择模型且介于 0–1。";
  return null;
}
export const scoreLabels: Record<string, string> = {
  vector: "Cosine",
  keyword: "BM25",
  fusion: "RRF",
  rerank: "Rerank",
};

/** 旧运行可能没有诊断；只展示具备所需结构的收据，不推测缺失阶段。 */
export function isRetrievalTrace(value: unknown): value is RetrievalTrace {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const numbers = [
    "denseCount",
    "keywordCount",
    "exactCount",
    "fusedCount",
    "rerankedCount",
    "deliveredCount",
    "embeddingMilliseconds",
    "recallMilliseconds",
    "rerankMilliseconds",
    "totalMilliseconds",
  ];
  if (
    !numbers.every((key) => typeof item[key] === "number") ||
    typeof item.mode !== "string" ||
    typeof item.rerankStatus !== "string"
  )
    return false;
  return (
    Array.isArray(item.candidates) &&
    item.candidates.length <= 224 &&
    item.candidates.every(
      (candidate) =>
        typeof candidate === "object" &&
        candidate !== null &&
        typeof candidate.id === "string" &&
        typeof candidate.reason === "string",
    )
  );
}
