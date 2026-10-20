"use client";
import { StatusBadge } from "@/features/knowledge/knowledge-ui";
import styles from "@/features/knowledge/knowledge.module.css";
import { ArrowUpRight, Database } from "lucide-react";
import type { KnowledgeLibrary } from "../api";
import type { KnowledgePanelController } from "../controllers/use-knowledge-list";
export function KnowledgeLibraryCard({
  controller,
  library,
}: {
  controller: KnowledgePanelController;
  library: KnowledgeLibrary;
}) {
  const { setSelected, labelFor } = controller;
  return (
    <button
      type="button"
      className={styles.library}
      key={library.id}
      onClick={() => setSelected(library.id)}
    >
      <div className={styles.libraryTop}>
        <div className={styles.libraryIcon}>
          <Database size={21} aria-hidden />
        </div>
        <StatusBadge library={library} />
      </div>
      <h3>{library.name}</h3>
      <p>{library.description || "暂无用途说明，可进入查看文档与索引版本。"}</p>
      <div className={styles.libraryFooter}>
        <span title={labelFor(library.modelId)}>{labelFor(library.modelId)}</span>
        <ArrowUpRight size={17} aria-hidden />
      </div>
    </button>
  );
}
