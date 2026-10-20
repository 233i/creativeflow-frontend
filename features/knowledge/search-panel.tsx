"use client";
import { useState } from "react";
import { Loader2, Search, ScanSearch } from "lucide-react";
import { Textarea } from "tdesign-react";
import { Button } from "@/components/ui/button";
import { type KnowledgeSearch } from "./api";
import { useKnowledgeSearch } from "./controllers/use-knowledge-search";
import { ChunkList, KnowledgeEmpty, KnowledgeError } from "./knowledge-ui";
import { RetrievalSettingsForm } from "./retrieval-settings";
import { RetrievalTraceView } from "./retrieval-trace";
import { scoreLabels } from "./retrieval-types";
import { RetrievalEvaluationPanel } from "./retrieval-evaluation";
import styles from "./knowledge.module.css";

/** 共享检索服务的显式测试，结果与固定版本绑定。 */
export function KnowledgeSearchPanel({
  libraryId,
  activeVersion,
  activeName,
  enabled,
  indexAvailable,
  indexSchema = "dense-v1",
}: {
  libraryId: string;
  activeVersion: string | null;
  activeName: string;
  enabled: boolean;
  indexAvailable: boolean;
  indexSchema?: string;
}) {
  const [evaluationBusy, setEvaluationBusy] = useState(false);
  const hybridAvailable = indexSchema === "hybrid-v1";
  const c = useKnowledgeSearch({
    libraryId,
    activeVersion,
    enabled,
    indexAvailable,
    hybridAvailable,
  });
  const busy = c.busy || evaluationBusy;
  return (
    <div className="space-y-5">
      <div className={styles.searchLayout}>
        <form
          className={`${styles.card} ${styles.searchForm}`}
          aria-label="检索测试"
          onSubmit={(event) => {
            event.preventDefault();
            if (!evaluationBusy) void c.search();
          }}
        >
          <h3>检索质量测试</h3>
          <p className={styles.muted}>检查召回与排序，不生成回答，也不调用聊天模型。</p>
          <label className={styles.field}>
            <span>检索问题</span>
            <Textarea
              aria-label="检索问题"
              placeholder="输入问题或提取后的检索词"
              maxlength={2000}
              value={c.query}
              disabled={busy}
              onChange={c.setQuery}
            />
          </label>
          <details className="text-xs">
            <summary className="cursor-pointer">检索词已改写？补充原始问题</summary>
            <Textarea
              className="mt-2"
              aria-label="检索原始问题"
              maxlength={2000}
              value={c.original}
              disabled={busy}
              onChange={c.setOriginal}
              placeholder="可保护原始问题中的字段名、编码；重排序也使用原始问题"
            />
          </details>
          <RetrievalSettingsForm
            value={c.settings}
            onChange={c.changeSettings}
            disabled={busy}
            hybridAvailable={hybridAvailable}
          />
          <KnowledgeError message={c.error} />
          {c.disabledReason && <p className={styles.inlineNotice}>{c.disabledReason}</p>}
          <Button
            className={`${styles.primary} w-full`}
            type="submit"
            isDisabled={busy || !c.valid}
          >
            {c.busy ? <Loader2 className="animate-spin" /> : <Search />}
            {c.busy ? "正在检索…" : "发送检索测试"}
          </Button>
          <p className={styles.muted}>
            纯关键词不调用向量模型；向量/混合每次向量化一次。启用重排序时额外调用一次模型，可能产生费用；不自动重试。
          </p>
        </form>
        <section className={styles.card} aria-label="检索结果">
          <div className={styles.cardHeader}>
            <div>
              <h3>检索结果</h3>
              <p>{activeVersion ? `当前固定版本 ${activeName}` : "等待激活版本"}</p>
            </div>
          </div>
          <SearchResults busy={c.busy} result={c.result} />
        </section>
      </div>
      {activeVersion && hybridAvailable && enabled && indexAvailable && (
        <RetrievalEvaluationPanel
          key={activeVersion}
          libraryId={libraryId}
          versionId={activeVersion}
          query={c.query}
          result={c.result}
          settings={c.settings}
          searchBusy={c.busy}
          onBusyChange={setEvaluationBusy}
        />
      )}
    </div>
  );
}
function SearchResults({ busy, result }: { busy: boolean; result: KnowledgeSearch | null }) {
  if (busy)
    return (
      <div className={styles.loading} role="status">
        <Loader2 className="animate-spin" size={16} />
        召回 → 融合 → 重排 → 选片；请勿重复提交
      </div>
    );
  if (!result)
    return (
      <KnowledgeEmpty title="看看知识库能找到什么" icon={<ScanSearch size={25} />}>
        输入问题并显式发送测试，查看原文、来源与各阶段排名。
      </KnowledgeEmpty>
    );
  return (
    <div className={styles.resultBody} role="status">
      <RetrievalTraceView trace={result.trace} />
      {result.hits.length === 0 && (
        <KnowledgeEmpty title="没有找到依据" icon={<Search size={24} />}>
          检查资料、阈值或精确标识要求。
        </KnowledgeEmpty>
      )}
      {result.truncated && (
        <p className="mt-3 text-xs text-amber-700">
          已按交付数量省略 {result.omittedCount} 个候选片段，未截断正文。
        </p>
      )}
      {result.hits.map((hit, index) => (
        <div key={hit.chunk.id} className="mt-4">
          <div className={styles.score}>
            <span>{hit.role === "supporting" ? "邻接补充" : "主命中"}</span>
            <span>
              {scoreLabels[hit.scoreType ?? "vector"] ?? hit.scoreType} {hit.score.toFixed(4)}
              （不是概率）
            </span>
          </div>
          <ChunkList chunks={[hit.chunk]} startIndex={index} />
        </div>
      ))}
    </div>
  );
}
