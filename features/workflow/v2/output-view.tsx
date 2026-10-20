"use client";

import { MAX_CONTEXT_CHUNKS } from "./knowledge-limits";
import { RetrievalTraceView } from "@/features/knowledge/retrieval-trace";
import { isRetrievalTrace, scoreLabels } from "@/features/knowledge/retrieval-types";

interface Source {
  id: string;
  document: string;
  startLine: number;
  endLine: number;
  text: string;
  versionId?: string;
  score?: number;
  scoreType?: string;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function sources(value: unknown): value is Source[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_CONTEXT_CHUNKS &&
    value.every(
      (item) =>
        record(item) &&
        typeof item.id === "string" &&
        typeof item.document === "string" &&
        typeof item.text === "string" &&
        typeof item.startLine === "number" &&
        typeof item.endLine === "number",
    )
  );
}

/** 只呈现已鉴权运行响应里的来源正文；不渲染 Markdown、远程链接或可执行 HTML。 */
export function V2OutputView({ fields }: { fields: Record<string, unknown> }) {
  return (
    <div aria-label="节点输出" className="space-y-3">
      {Object.entries(fields).map(([key, value]) => (
        <OutputField key={key} name={key} value={value} />
      ))}
    </div>
  );
}
function OutputField({ name: key, value }: { name: string; value: unknown }) {
  if (
    record(value) &&
    typeof value.text === "string" &&
    typeof value.grounded === "boolean" &&
    sources(value.citations)
  )
    return (
      <article key={key} className="rounded-xl border bg-background p-3">
        <div className="mb-2 flex gap-2 text-[11px] text-muted-foreground">
          <span>{key}</span>
          <span>
            {value.grounded ? `知识库回答 · ${value.citations.length} 个来源` : "依据不足"}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{value.text}</p>
        <SourceList items={value.citations} />
        {value.grounded && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            引用归属已校验，事实准确性仍请结合原文核对。
          </p>
        )}
      </article>
    );
  if (record(value) && sources(value.hits))
    return (
      <article key={key} className="rounded-xl border bg-background p-3">
        {typeof value.question === "string" && (
          <p className="mb-2 max-h-24 overflow-auto whitespace-pre-wrap break-words text-xs">
            <span className="text-muted-foreground">检索词：</span>
            {value.question}
          </p>
        )}
        <strong className="text-xs">交付 {value.hits.length} 个片段</strong>
        {value.truncated === true && <TruncationNotice value={value} />}
        {value.hits.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">当前阈值下没有找到依据。</p>
        )}
        <SourceList items={value.hits} />
        {isRetrievalTrace(value.trace) && <RetrievalTraceView trace={value.trace} compact />}
      </article>
    );
  return (
    <pre
      key={key}
      className="overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-xs"
    >
      {key}: {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}
function TruncationNotice({ value }: { value: Record<string, unknown> }) {
  const message =
    value.truncationReason === "chunk_limit" &&
    typeof value.maxContextChunks === "number" &&
    typeof value.omittedCount === "number"
      ? `已达 ${value.maxContextChunks} 个片段上限，省略 ${value.omittedCount} 个候选片段。`
      : "部分候选未交付；该历史运行未记录具体限制原因。";
  return <p className="mt-1 text-xs text-amber-700">{message}</p>;
}

function SourceList({ items }: { items: Source[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      {items.map((source, i) => (
        <details key={`${source.id}:${i}`} className="rounded-lg border bg-muted/20 p-2 text-xs">
          <summary className="cursor-pointer break-words">
            [{i + 1}] {source.document} · 第 {source.startLine}–{source.endLine} 行
            {typeof source.score === "number" &&
              ` · ${scoreLabels[source.scoreType ?? "vector"] ?? source.scoreType} ${source.score.toFixed(3)}`}
          </summary>
          <blockquote className="mt-2 whitespace-pre-wrap break-words border-l-2 pl-3 leading-5">
            {source.text}
          </blockquote>
          {source.versionId && (
            <p className="mt-2 break-all text-[10px] text-muted-foreground">
              固定版本 {source.versionId}
            </p>
          )}
        </details>
      ))}
    </div>
  );
}
