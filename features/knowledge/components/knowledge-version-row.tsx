"use client";
import { type KnowledgeVersion } from "@/features/knowledge/api";
import type { VersionsPanelController } from "@/features/knowledge/controllers/use-knowledge-versions";
import { formatDate, StatusBadge, versionName } from "@/features/knowledge/knowledge-ui";
import styles from "@/features/knowledge/knowledge.module.css";
import { CheckCircle2 } from "lucide-react";
import { Fragment } from "react";
import { VersionActions } from "./version-actions";
export function KnowledgeVersionRow({
  controller,
  version,
}: {
  controller: VersionsPanelController;
  version: KnowledgeVersion;
}) {
  const { versions, activeVersion } = controller;
  return (
    <Fragment key={version.id}>
      <tr>
        <td>
          <div className={styles.versionName}>
            {versionName(versions, version.id)}{" "}
            {version.id === activeVersion && (
              <CheckCircle2 size={14} className="text-[var(--success)]" aria-hidden />
            )}
          </div>
          <p className={`${styles.muted} mt-2 whitespace-nowrap`}>
            {formatDate(version.createdAt)}
          </p>
          <p className={`${styles.muted} mt-1`}>
            {version.indexSchema === "hybrid-v1" ? "向量＋BM25 混合索引" : "仅向量索引"} · 解析{" "}
            {version.parserVersion ?? "legacy"}
            {version.chunkSize ? ` · ${version.chunkSize} 字符 / 重叠 ${version.overlap ?? 0}` : ""}
          </p>
          <details className={`${styles.muted} mt-1`}>
            <summary className="cursor-pointer">任务 ID</summary>
            <code className="block max-w-52 break-all text-[10px]">{version.id}</code>
          </details>
        </td>
        <td>
          <StatusBadge version={version} active={version.id === activeVersion} />
        </td>
        <td className="whitespace-nowrap">{version.documentCount} 份</td>
        <td>
          <span className={styles.muted}>
            向量 {version.embeddedCount} / {version.chunkCount} 段 · 复用 {version.reusedCount ?? 0}
          </span>
          <progress
            className={styles.progress}
            aria-label={`${versionName(versions, version.id)} 向量完成进度`}
            value={version.embeddedCount}
            max={Math.max(1, version.chunkCount)}
          />
          <span className={styles.muted}>
            索引 {version.writtenCount ?? (version.status === "ready" ? version.chunkCount : 0)} /{" "}
            {version.chunkCount} 段
          </span>
          <progress
            className={styles.progress}
            aria-label={versionName(versions, version.id) + " 索引写入进度"}
            value={version.writtenCount ?? (version.status === "ready" ? version.chunkCount : 0)}
            max={Math.max(1, version.chunkCount)}
          />
        </td>
        <VersionActions controller={controller} version={version} />
      </tr>
      {version.error && (
        <tr>
          <td colSpan={5} className={styles.versionError}>
            {version.error}
          </td>
        </tr>
      )}
    </Fragment>
  );
}
