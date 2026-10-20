"use client";
import { Button } from "@/components/ui/button";
import type { KnowledgeDetailPanelController } from "@/features/knowledge/controllers/use-knowledge-detail";
import { StatusBadge } from "@/features/knowledge/knowledge-ui";
import styles from "@/features/knowledge/knowledge.module.css";
import { knowledgeVersionView } from "@/features/knowledge/version-selection";
import { Info, RefreshCw, Upload } from "lucide-react";
export function KnowledgeDetailHeader({
  controller,
}: {
  controller: KnowledgeDetailPanelController & ReturnType<typeof knowledgeVersionView>;
}) {
  const { busy, setImportOpen, setSettingsOpen, run, library } = controller;
  return (
    <header className={styles.header}>
      <div className="min-w-0">
        <div className={styles.heading}>
          <h2>{library.name}</h2>
          <StatusBadge library={library} />
        </div>
        <p className={styles.subtitle}>{library.description || "管理文档，让知识持续可用。"}</p>
      </div>
      <div className={styles.actions}>
        <Button
          variant="outline"
          size="icon"
          aria-label="知识库设置"
          onPress={() => setSettingsOpen(true)}
        >
          <Info />
        </Button>
        <Button variant="outline" isDisabled={busy} onPress={() => void run(async () => {})}>
          <RefreshCw className={busy ? "animate-spin" : ""} />
          刷新状态
        </Button>
        <Button
          className={styles.primary}
          isDisabled={!library.enabled || busy}
          onPress={() => setImportOpen(true)}
        >
          <Upload />
          导入文档
        </Button>
      </div>
    </header>
  );
}
