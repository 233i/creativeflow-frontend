"use client";
import type { KnowledgeDetailPanelController } from "@/features/knowledge/controllers/use-knowledge-detail";
import { formatDate, versionName } from "@/features/knowledge/knowledge-ui";
import styles from "@/features/knowledge/knowledge.module.css";
import { knowledgeVersionView } from "@/features/knowledge/version-selection";
export function KnowledgeVersionStats({
  controller,
}: {
  controller: KnowledgeDetailPanelController & ReturnType<typeof knowledgeVersionView>;
}) {
  const { library, versions, active } = controller;
  return (
    <dl className={styles.stats} aria-label="当前激活版本概览">
      <div className={styles.stat}>
        <dt>当前检索版本</dt>
        <dd>{versionName(versions, library.activeVersion)}</dd>
      </div>
      <div className={styles.stat}>
        <dt>当前文档</dt>
        <dd>
          {active?.documentCount ?? "—"}
          <small>份</small>
        </dd>
      </div>
      <div className={styles.stat}>
        <dt>当前分段</dt>
        <dd>
          {active?.chunkCount ?? "—"}
          <small>段</small>
        </dd>
      </div>
      <div className={styles.stat}>
        <dt>当前版本创建时间</dt>
        <dd className={styles.date}>{active ? formatDate(active.createdAt) : "等待首次入库"}</dd>
      </div>
    </dl>
  );
}
