"use client";
import type { NodeConfiguration } from "./domain/nodes";
import { DEFAULT_CONTEXT_CHUNKS } from "./knowledge-limits";
import { retrievalModes } from "@/features/knowledge/retrieval-trace";
function phase(progress: number, mode: string) {
  if (progress < 25) return mode === "keyword" ? "正在准备关键词" : "正在向量化检索词";
  return [
    [50, "正在召回候选"],
    [65, "正在融合排名"],
    [98, "正在重排序"],
    [101, "正在验证与保存结果"],
  ].find(([threshold]) => progress < Number(threshold))?.[1];
}
/** 与持久化节点百分比对应的阶段，不使用假的模型推理百分比。 */
export function KnowledgeRetrievalSummary({
  data,
  running,
  progress,
}: {
  data: NodeConfiguration;
  running: boolean;
  progress: number | null;
}) {
  const mode = data.retrievalMode ?? "vector";
  return (
    <p className="mb-2 px-4 text-muted-foreground">
      {data.versionId
        ? `固定版本 ${data.versionId.slice(-6)} · TopK ${data.topK} · 最多 ${data.maxContextChunks ?? DEFAULT_CONTEXT_CHUNKS} 段`
        : "请选择已授权知识库和版本"}
      {" · "}
      {retrievalModes[mode]}
      {data.rerankModelId ? " · 重排序" : ""}
      {running && progress !== null && (
        <span className="mt-1 block text-primary">{phase(progress, mode)}</span>
      )}
    </p>
  );
}
