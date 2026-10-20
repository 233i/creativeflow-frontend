"use client";
import { useEffect, useRef, useState } from "react";
import { Checkbox } from "tdesign-react";
import { Button } from "@/components/ui/button";
import {
  knowledgeApi,
  type EvaluationCase,
  type EvaluationResult,
  type KnowledgeSearch,
} from "./api";
import { retrievalError, type RetrievalSettings } from "./retrieval-types";
import { KnowledgeError } from "./knowledge-ui";
import { RetrievalTraceView } from "./retrieval-trace";

/** 人工从当前固定版本标注相关片段，比较同题同版本，不用回答模型自评。 */
export function RetrievalEvaluationPanel({
  libraryId,
  versionId,
  query,
  result,
  settings,
  searchBusy,
  onBusyChange,
}: {
  libraryId: string;
  versionId: string;
  query: string;
  result: KnowledgeSearch | null;
  settings: RetrievalSettings;
  searchBusy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [cases, setCases] = useState<EvaluationCase[]>([]);
  const [relevant, setRelevant] = useState<string[]>([]);
  const [ranking, setRanking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [evaluation, setEvaluation] = useState<{
    signature: string;
    result: EvaluationResult;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  const signature = JSON.stringify(settings);
  const includeRanking = includeRerank(ranking, settings);
  const visibleEvaluation = metricsForSettings(evaluation, signature);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      onBusyChange(false);
    };
  }, [onBusyChange]);
  const selected = (result?.hits ?? [])
    .filter((hit) => relevant.includes(hit.chunk.id))
    .map((hit) => hit.chunk.id);
  async function evaluate() {
    if (lock.current || searchBusy || cases.length === 0 || retrievalError(settings)) return;
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    setEvaluation(null);
    try {
      const next = await knowledgeApi.evaluate(libraryId, cases, settings, includeRanking);
      if (next.versionId !== versionId) throw new Error("版本已变化，标注不能跨版本复用。");
      if (alive.current) {
        setEvaluation({ signature, result: next });
      }
    } catch (reason) {
      if (alive.current) setError(reason instanceof Error ? reason.message : "评测失败");
    } finally {
      lock.current = false;
      if (alive.current) {
        setBusy(false);
        onBusyChange(false);
      }
    }
  }
  function addCase() {
    setCases((current) => [
      ...current.filter((item) => item.query !== query),
      { query, relevantChunkIds: selected },
    ]);
    setRelevant([]);
    setEvaluation(null);
  }
  return (
    <details className="rounded-xl border bg-background p-5">
      <summary className="cursor-pointer font-semibold">
        对照评测 · 向量 / 混合 / 混合＋重排序
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-xs leading-5 text-muted-foreground">
          先执行上方检索，勾选真正相关的原文作为标注，再加入题集。最多 16
          题；每题只向量化一次，所有策略使用相同版本与
          TopK，不调用回答模型。相邻补充不计入排名指标。
        </p>
        <div className="space-y-2">
          {result?.versionId === versionId &&
            result.hits.map((hit) => (
              <Checkbox
                key={hit.chunk.id}
                checked={selected.includes(hit.chunk.id)}
                disabled={busy || searchBusy}
                onChange={(checked) =>
                  setRelevant((current) =>
                    checked
                      ? [...current, hit.chunk.id]
                      : current.filter((id) => id !== hit.chunk.id),
                  )
                }
              >
                {hit.chunk.document} · {hit.chunk.startLine}–{hit.chunk.endLine} 行 ·{" "}
                {hit.chunk.id.slice(-8)}
              </Checkbox>
            ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          isDisabled={
            busy || searchBusy || !query.trim() || selected.length === 0 || cases.length >= 16
          }
          onPress={addCase}
        >
          将当前问题与相关片段加入题集
        </Button>
        <ol className="space-y-2 text-xs">
          {cases.map((item, index) => (
            <li key={item.query} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 break-words">
                {index + 1}. {item.query} · {item.relevantChunkIds.length} 个相关片段
              </span>
              <Button
                size="sm"
                variant="ghost"
                isDisabled={busy}
                onPress={() => {
                  setCases((current) => current.filter((value) => value !== item));
                  setEvaluation(null);
                }}
              >
                移除
              </Button>
            </li>
          ))}
        </ol>
        <Checkbox
          checked={includeRanking}
          disabled={busy || !settings.rerankModelId}
          onChange={(next) => {
            setRanking(next);
            setEvaluation(null);
          }}
        >
          同时测试已选重排序模型（每题额外调用一次，可能计费）
        </Checkbox>
        <KnowledgeError message={error} />
        <Button
          isDisabled={busy || searchBusy || cases.length === 0 || Boolean(retrievalError(settings))}
          onPress={() => void evaluate()}
        >
          {busy ? "评测中，请勿重复提交…" : `确认运行 ${cases.length} 题对照评测`}
        </Button>
        <EvaluationResults evaluation={visibleEvaluation} />
      </div>
    </details>
  );
}
function includeRerank(selected: boolean, settings: RetrievalSettings) {
  return selected && Boolean(settings.rerankModelId);
}
/** 修改选片参数后旧指标不再具有可比性，必须重新显式执行评测。 */
function metricsForSettings(
  receipt: { signature: string; result: EvaluationResult } | null,
  signature: string,
) {
  return receipt?.signature === signature ? receipt.result : null;
}
function EvaluationResults({ evaluation }: { evaluation: EvaluationResult | null }) {
  return (
    evaluation && (
      <section aria-label="检索对照评测结果" className="space-y-3">
        <p className="text-xs text-muted-foreground">
          固定版本 {evaluation.versionId} ·
          结果可展开核对每题候选；指标越高越好，不等同于答案正确率。
        </p>
        {evaluation.metrics.map((metric) => (
          <details key={metric.strategy} className="rounded border p-3 text-xs">
            <summary className="cursor-pointer">
              <strong>{metric.strategy}</strong> · Recall {metric.recall.toFixed(3)} · MRR{" "}
              {metric.mrr.toFixed(3)} · NDCG {metric.ndcg.toFixed(3)} · 排序{" "}
              {metric.elapsedMilliseconds} ms
            </summary>
            {metric.results.map((value, i) => (
              <div key={i} className="mt-3">
                <strong>问题 {i + 1}</strong>
                <RetrievalTraceView trace={value.trace} />
              </div>
            ))}
          </details>
        ))}
      </section>
    )
  );
}
