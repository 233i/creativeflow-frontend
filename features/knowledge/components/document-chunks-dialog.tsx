"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  knowledgeApi,
  type KnowledgeChunk,
  type KnowledgeDocumentSummary,
} from "@/features/knowledge/api";
import { ChunkList, KnowledgeError } from "@/features/knowledge/knowledge-ui";
import styles from "@/features/knowledge/knowledge.module.css";
import { useEffect, useState } from "react";

export function DocumentChunksDialog({
  libraryId,
  versionId,
  document,
  onClose,
}: {
  libraryId: string;
  versionId: string;
  document: KnowledgeDocumentSummary;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className={styles.modal}
    >
      <div className={styles.modalHeader}>
        <DialogTitle>{document.name}</DialogTitle>
        <DialogDescription className="mt-2 text-xs">
          {document.chunkCount} 个片段 · 原始行号 · 仅展示纯文本，不执行文档中的指令
        </DialogDescription>
      </div>
      <div className={styles.modalBody}>
        <ChunkPage
          key={page}
          libraryId={libraryId}
          versionId={versionId}
          documentId={document.id}
          offset={page * 128}
        />
      </div>
      <div className={styles.modalFooter}>
        <Button variant="outline" isDisabled={page === 0} onPress={() => setPage(page - 1)}>
          上一页
        </Button>
        <span className={styles.muted}>
          {page + 1} / {Math.max(1, Math.ceil(document.chunkCount / 128))}
        </span>
        <Button
          variant="outline"
          isDisabled={(page + 1) * 128 >= document.chunkCount}
          onPress={() => setPage(page + 1)}
        >
          下一页
        </Button>
        <Button variant="outline" onPress={onClose}>
          关闭预览
        </Button>
      </div>
    </Dialog>
  );
}

function ChunkPage({
  libraryId,
  versionId,
  documentId,
  offset,
}: {
  libraryId: string;
  versionId: string;
  documentId: string;
  offset: number;
}) {
  const [chunks, setChunks] = useState<KnowledgeChunk[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    void knowledgeApi
      .chunks(libraryId, versionId, documentId, offset)
      .then((value) => {
        if (!disposed) setChunks(value);
      })
      .catch((reason) => {
        if (!disposed) setError(reason instanceof Error ? reason.message : "分段读取失败");
      });
    return () => {
      disposed = true;
    };
  }, [libraryId, versionId, documentId, offset]);
  return error ? (
    <KnowledgeError message={error} />
  ) : chunks ? (
    <ChunkList chunks={chunks} startIndex={offset} />
  ) : (
    <p role="status">正在读取分段…</p>
  );
}
