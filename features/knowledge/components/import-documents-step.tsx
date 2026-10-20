"use client";
import { Button } from "@/components/ui/button";
import type { KnowledgeImportPanelController } from "@/features/knowledge/controllers/use-knowledge-import";
import styles from "@/features/knowledge/knowledge.module.css";
import { FileText, Upload, X } from "lucide-react";
export function ImportDocumentsStep({
  controller,
}: {
  controller: KnowledgeImportPanelController;
}) {
  const {
    quotas,
    documents,
    setDocuments,
    chunkSize,
    setChunkSize,
    overlap,
    setOverlap,
    setPreview,
    busy,
    dragging,
    setDragging,
    choose,
  } = controller;
  return (
    <fieldset disabled={busy}>
      <label
        className={styles.dropzone}
        data-dragging={dragging}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          choose(Array.from(event.dataTransfer.files));
        }}
      >
        <Upload size={28} aria-hidden />
        <b>点击选择，或拖拽文档到这里</b>
        <span>
          UTF-8 TXT / Markdown · 最多 {quotas.maxDocuments} 份 · 合计不超过{" "}
          {quotas.maxVersionBytes / 1024} KiB
          <br />
          暂不支持 PDF / DOCX
        </span>
        <input
          aria-label="选择文档"
          type="file"
          accept=".txt,.md"
          multiple
          onChange={(event) => {
            choose(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </label>
      <div className={styles.selectedFiles}>
        {documents.map((document) => (
          <div className={styles.selectedFile} key={document.name}>
            <FileText size={17} aria-hidden />
            <span>{document.name}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`移除 ${document.name}`}
              isDisabled={busy}
              onPress={() => {
                setDocuments(documents.filter((item) => item.name !== document.name));
                setPreview(null);
              }}
            >
              <X size={14} />
            </Button>
          </div>
        ))}
      </div>
      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>分段长度</span>
          <input
            aria-label="分段长度"
            className={styles.control}
            type="number"
            min={200}
            max={1600}
            value={chunkSize}
            onChange={(event) => {
              setChunkSize(Number(event.target.value));
              setPreview(null);
            }}
          />
          <small>每段 200–1600 个字符</small>
        </label>
        <label className={styles.field}>
          <span>重叠字符</span>
          <input
            aria-label="重叠字符"
            className={styles.control}
            type="number"
            min={0}
            max={400}
            value={overlap}
            onChange={(event) => {
              setOverlap(Number(event.target.value));
              setPreview(null);
            }}
          />
          <small>0–400，且小于分段长度的一半</small>
        </label>
      </div>
      <p className={styles.inlineNotice}>
        下一步仅预览分段，<strong>不会保存文档或调用向量模型</strong>。
      </p>
    </fieldset>
  );
}
