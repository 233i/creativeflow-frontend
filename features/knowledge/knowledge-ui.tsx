"use client";

import type { ReactNode } from "react";
import { AlertCircle, Check, Copy, Database, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { KnowledgeChunk, KnowledgeLibrary, KnowledgeVersion } from "./api";
import styles from "./knowledge.module.css";

export const statusLabels = {
  queued: "排队中",
  embedding: "向量化中",
  writing: "保存索引",
  ready: "待激活",
  failed: "处理失败",
  unknown: "待核对",
  cleaning: "清理中",
  cleanup_failed: "清理失败",
  deleted: "已清理",
};
export const isProcessing = (version: KnowledgeVersion) =>
  ["queued", "embedding", "writing", "cleaning"].includes(version.status);
export const versionName = (versions: KnowledgeVersion[], id: string | null) => {
  const index = versions.findIndex((version) => version.id === id);
  return index < 0 ? "未激活" : `V${versions[index].number || versions.length - index}`;
};
export const formatDate = (date: string) =>
  new Date(date).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

/** 按来源分组，不把文档正文解释为 HTML 或 Markdown。 */
export function groupDocuments(chunks: KnowledgeChunk[]) {
  const groups = new Map<string, KnowledgeChunk[]>();
  for (const chunk of chunks)
    groups.set(chunk.document, [...(groups.get(chunk.document) ?? []), chunk]);
  return [...groups].map(([name, parts]) => ({ name, chunks: parts }));
}

export function StatusBadge({
  library,
  version,
  active = false,
}: {
  library?: KnowledgeLibrary;
  version?: KnowledgeVersion;
  active?: boolean;
}) {
  const label = library
    ? !library.enabled
      ? "已停用"
      : library.activeVersion
        ? "可检索"
        : "待配置"
    : active
      ? "当前使用"
      : version
        ? statusLabels[version.status]
        : "未激活";
  const tone = library
    ? !library.enabled
      ? "muted"
      : library.activeVersion
        ? "success"
        : "muted"
    : active
      ? "success"
      : version?.status === "failed"
        ? "danger"
        : version?.status === "unknown"
          ? "warning"
          : version?.status === "ready"
            ? "brand"
            : "muted";
  return (
    <span className={styles.badge} data-tone={tone}>
      {version && isProcessing(version) ? (
        <Loader2 size={12} className="animate-spin" aria-hidden />
      ) : (
        <span className={styles.dot} />
      )}
      {label}
    </span>
  );
}

export function KnowledgeError({ message }: { message: string | null }) {
  return message ? (
    <div role="alert" className={styles.error}>
      <AlertCircle size={16} aria-hidden />
      <span>{message}</span>
    </div>
  ) : null;
}

export function KnowledgeEmpty({
  title,
  children,
  action,
  icon,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>{icon ?? <Database size={24} aria-hidden />}</div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

/** 复制失败有反馈，不把失败当作成功；完整 ID 仍可手动选中复制。 */
export function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className={styles.copyId}>
      <code>{id}</code>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="复制知识库 ID"
        onPress={async () => {
          try {
            await navigator.clipboard.writeText(id);
            setCopied(true);
            setError(false);
          } catch {
            setError(true);
          }
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </Button>
      <span className="sr-only" role="status">
        {error ? "复制失败，请手动选择 ID 复制" : copied ? "已复制知识库 ID" : ""}
      </span>
    </div>
  );
}

/** 片段永远以纯文本展示，行号来自服务端解析结果。 */
export function ChunkList({
  chunks,
  startIndex = 0,
}: {
  chunks: KnowledgeChunk[];
  startIndex?: number;
}) {
  return (
    <div className={styles.chunks} aria-label="分段列表">
      {chunks.map((chunk, index) => (
        <article key={chunk.id} className={styles.chunk}>
          <div className={styles.chunkMeta}>
            <span>片段 {String(startIndex + index + 1).padStart(2, "0")}</span>
            <span>
              {chunk.document} · 第 {chunk.startLine}–{chunk.endLine} 行
            </span>
            {chunk.sectionPath && <span title={chunk.sectionPath}>{chunk.sectionPath}</span>}
            {chunk.blockType && (
              <span>
                {chunk.blockType}
                {chunk.continuation ? " · 续片段" : ""}
              </span>
            )}
            {chunk.startOffset !== undefined && chunk.endOffset !== undefined && (
              <span>
                offset {chunk.startOffset}–{chunk.endOffset}
              </span>
            )}
          </div>
          <pre>{chunk.text}</pre>
        </article>
      ))}
    </div>
  );
}

/** 大预览只渲染当前页，服务端仍校验完整资料摘要。 */
export function PagedChunks({ chunks }: { chunks: KnowledgeChunk[] }) {
  const [page, setPage] = useState(0);
  const size = 32;
  return (
    <>
      <ChunkList chunks={chunks.slice(page * size, (page + 1) * size)} startIndex={page * size} />
      {chunks.length > size && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            isDisabled={page === 0}
            onPress={() => setPage(page - 1)}
          >
            上一页
          </Button>
          <span className="text-xs">
            {page + 1} / {Math.ceil(chunks.length / size)}
          </span>
          <Button
            variant="outline"
            size="sm"
            isDisabled={(page + 1) * size >= chunks.length}
            onPress={() => setPage(page + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </>
  );
}
