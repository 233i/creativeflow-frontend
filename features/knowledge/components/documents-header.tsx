"use client";
import { Button } from "@/components/ui/button";
import { versionName } from "@/features/knowledge/knowledge-ui";
import styles from "@/features/knowledge/knowledge.module.css";
import { Plus } from "lucide-react";
import type { DocumentsPanelController } from "../controllers/use-knowledge-documents";
export function DocumentsHeader({ controller }: { controller: DocumentsPanelController }) {
  const { versionId, activeVersion, versions, onVersionChange, documents, setChange, canChange } =
    controller;
  return (
    <div className={styles.cardHeader}>
      <div>
        <h3>
          文档 <span className="ml-1 text-muted-foreground">{documents?.length ?? ""}</span>
        </h3>
        <p>更新不会覆盖历史版本与已发布工作流</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          查看版本
          <select
            aria-label="文档版本"
            className={styles.control + " !w-auto !py-1.5"}
            value={versionId ?? ""}
            onChange={(event) => onVersionChange(event.target.value)}
          >
            {versions
              .filter((item) => !["cleaning", "cleanup_failed", "deleted"].includes(item.status))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {versionName(versions, item.id)}
                  {item.id === activeVersion ? " · 当前使用" : ""}
                </option>
              ))}
          </select>
        </label>
        <Button size="sm" isDisabled={!canChange} onPress={() => setChange({ action: "add" })}>
          <Plus />
          新增文档
        </Button>
      </div>
    </div>
  );
}
