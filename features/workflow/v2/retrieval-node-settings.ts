import type { RetrievalSettings } from "@/features/knowledge/retrieval-types";
import type { WorkflowV2NodeData } from "./types";
/** 旧的未声明策略节点仍显示向量模式；新节点默认混合，绝不偷换固定版本。 */
export function retrievalNodeSettings(
  data: WorkflowV2NodeData<"knowledgeRetrieve">,
): RetrievalSettings {
  return {
    mode: data.retrievalMode ?? "vector",
    denseCandidates: data.denseCandidates ?? Math.min(32, Math.max(8, (data.topK ?? 4) * 4)),
    keywordCandidates: data.keywordCandidates ?? 32,
    rerankCandidates: data.rerankCandidates ?? 24,
    topK: data.topK ?? 4,
    maxContextChunks: data.maxContextChunks ?? 8,
    minVectorScore: data.minScore ?? 0,
    minRerankScore: data.minRerankScore ?? null,
    neighborRadius: data.neighborRadius ?? 1,
    exactMatch: data.exactMatch ?? "prefer",
    rerankModelId: data.rerankModelId ?? null,
    rerankFailurePolicy: data.rerankFailurePolicy ?? "fail",
  };
}
export function applyRetrievalSettings(
  data: WorkflowV2NodeData<"knowledgeRetrieve">,
  value: RetrievalSettings,
): WorkflowV2NodeData<"knowledgeRetrieve"> {
  return {
    ...data,
    retrievalMode: value.mode,
    denseCandidates: value.denseCandidates,
    keywordCandidates: value.keywordCandidates,
    rerankCandidates: value.rerankCandidates,
    topK: value.topK,
    maxContextChunks: value.maxContextChunks,
    minScore: value.minVectorScore,
    minRerankScore: value.minRerankScore ?? undefined,
    neighborRadius: value.neighborRadius,
    exactMatch: value.exactMatch,
    rerankModelId: value.rerankModelId ?? undefined,
    rerankFailurePolicy: value.rerankFailurePolicy,
  };
}
