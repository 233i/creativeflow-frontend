"use client";
import { Button } from "@/components/ui/button";
import type { DocumentsPanelController } from "@/features/knowledge/controllers/use-knowledge-documents";
import { versionName } from "@/features/knowledge/knowledge-ui";
import styles from "@/features/knowledge/knowledge.module.css";
import { FileText } from "lucide-react";
export function DocumentsTable({ controller }: { controller: DocumentsPanelController }) {
  const { versionId, versions, documents, setSelected, setChange, filtered, canChange } =
    controller;
  if (!documents) return null;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>文档名称</th>
          <th>分段 / 大小</th>
          <th className="text-right">操作</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((document) => (
          <tr key={document.id}>
            <td>
              <div className={styles.file}>
                <FileText size={21} aria-hidden />
                <div>
                  <b>{document.name}</b>
                  <small>
                    {document.name.toLowerCase().endsWith(".md") ? "Markdown" : "纯文本"} ·{" "}
                    {versionName(versions, versionId)}
                  </small>
                </div>
              </div>
            </td>
            <td className="whitespace-nowrap">
              {document.chunkCount} 段
              <small className="block text-muted-foreground">
                {(document.byteCount / 1024).toFixed(1)} KiB
              </small>
            </td>
            <td>
              <div className="flex flex-wrap justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => setSelected(document)}
                  aria-label={"查看 " + document.name + " 的分段"}
                >
                  查看分段
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  isDisabled={!canChange}
                  onPress={() => setChange({ action: "replace", document })}
                  aria-label={"更新 " + document.name}
                >
                  更新
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  isDisabled={!canChange || documents.length <= 1}
                  onPress={() => setChange({ action: "remove", document })}
                  aria-label={"移除 " + document.name}
                >
                  移除
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
