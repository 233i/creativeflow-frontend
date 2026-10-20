"use client";

import type { CandidateTrace, RetrievalTrace } from "./retrieval-types";
export const retrievalModes: Record<string, string> = {
  vector: "向量",
  keyword: "关键词",
  hybrid: "混合检索",
};
const statuses: Record<string, string> = {
  disabled: "未启用",
  completed: "已完成",
  fallback: "已降级",
  no_candidates: "无候选，未调用",
};
const reasons: Record<string, string> = {
  selected: "已交付",
  neighbor: "邻接补充",
  rerank_threshold: "低于重排阈值",
  rerank_candidate_limit: "未进入重排候选",
  topk_or_context_limit: "排名或交付数量限制",
};
function rank(rank: number | null, score: number | null) {
  return rank == null ? "—" : "#" + rank + (score == null ? "" : " / " + score.toFixed(4));
}
function CandidateRow({ item }: { item: CandidateTrace }) {
  return (
    <tr className="border-t [&>td]:p-2">
      <td>
        <code title={item.id}>{item.id.slice(-8)}</code>
        {item.exactMatched && <span className="ml-1 text-primary">精确</span>}
      </td>
      <td>{rank(item.denseRank, item.denseScore)}</td>
      <td>{rank(item.keywordRank, item.keywordScore)}</td>
      <td>{rank(item.fusionRank, item.fusionScore)}</td>
      <td>{rank(item.rerankRank, item.rerankScore)}</td>
      <td className={item.selected ? "text-primary" : "text-muted-foreground"}>
        {reasons[item.reason] ?? item.reason}
      </td>
    </tr>
  );
}
/** 收据不重复正文，原始分数、排名和选片原因分开呈现，避免误当概率。 */
export function RetrievalTraceView({
  trace,
  compact = false,
}: {
  trace: RetrievalTrace | null | undefined;
  compact?: boolean;
}) {
  if (!trace || !Array.isArray(trace.candidates)) return null;
  return (
    <section
      aria-label="检索执行诊断"
      className="mt-3 space-y-2 rounded-lg border bg-muted/10 p-3 text-xs"
    >
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <strong>{retrievalModes[trace.mode] ?? trace.mode}</strong>
        <span>
          向量 {trace.denseCount} · 关键词 {trace.keywordCount} · 精确 {trace.exactCount}
        </span>
        <span>
          融合 {trace.fusedCount} → 重排 {trace.rerankedCount} → 交付 {trace.deliveredCount}
        </span>
        <span>总耗时 {trace.totalMilliseconds} ms</span>
      </div>
      <p className="text-muted-foreground">
        向量化 {trace.embeddingMilliseconds} ms · 召回 {trace.recallMilliseconds} ms · 重排{" "}
        {trace.rerankMilliseconds} ms · 重排序 {statuses[trace.rerankStatus] ?? trace.rerankStatus}
      </p>
      {trace.originalQuestion && <p className="break-words">原始问题：{trace.originalQuestion}</p>}
      {trace.rerankError && (
        <p role="alert" className="break-words text-amber-700">
          {trace.rerankError}
        </p>
      )}
      {trace.rerankConfigurationVersion && (
        <p className="break-all text-muted-foreground">
          重排配置版本 {trace.rerankConfigurationVersion} · token{" "}
          {trace.rerankTokens ?? "上游未报告"}
        </p>
      )}
      <details open={compact ? undefined : true}>
        <summary className="cursor-pointer text-primary">
          候选排名、分数与选片原因（{trace.candidates.length}）
        </summary>
        <div className="mt-2 max-h-80 overflow-auto">
          <table className="w-full min-w-[560px] text-left text-[11px]">
            <thead>
              <tr className="[&>th]:p-2">
                <th>片段 ID</th>
                <th>向量</th>
                <th>BM25</th>
                <th>RRF</th>
                <th>Rerank</th>
                <th>处理结果</th>
              </tr>
            </thead>
            <tbody>
              {trace.candidates.map((item) => (
                <CandidateRow key={item.id} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
