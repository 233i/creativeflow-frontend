"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  knowledgeApi,
  readKnowledgeFiles,
  type DocumentChange,
  type KnowledgeDocumentSummary,
  type KnowledgePreview,
  type KnowledgeQuotas,
  type KnowledgeVersion,
} from "./api";
import { KnowledgeError, PagedChunks } from "./knowledge-ui";
import styles from "./knowledge.module.css";

/** 所有变更都先预览再确认，来源版本固定；迟到响应或详情刷新失败不会触发重复入库。 */
export function DocumentChangeDialog({
  libraryId,
  version,
  action,
  document,
  quotas,
  onClose,
  onChanged,
}: {
  libraryId: string;
  version: KnowledgeVersion;
  action: "add" | "replace" | "remove";
  document?: KnowledgeDocumentSummary;
  quotas: KnowledgeQuotas;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [changes, setChanges] = useState<DocumentChange[]>(
    action === "remove" && document
      ? [{ action, name: document.name, documentId: document.id }]
      : [],
  );
  const [text, setText] = useState("");
  const [chunkSize, setChunkSize] = useState(version.chunkSize ?? 800);
  const [overlap, setOverlap] = useState(version.overlap ?? 100);
  const [loading, setLoading] = useState(action === "replace");
  const [preview, setPreview] = useState<KnowledgePreview | null>(null);
  const [receipt, setReceipt] = useState<KnowledgeVersion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    if (action !== "replace" || !document) return;
    let disposed = false;
    void knowledgeApi
      .document(libraryId, version.id, document.id)
      .then((value) => {
        if (!disposed) setText(value.text);
      })
      .catch((reason) => {
        if (!disposed) setError(reason instanceof Error ? reason.message : "原文读取失败");
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [libraryId, version.id, action, document]);
  const actualChanges: DocumentChange[] =
    action === "replace" && document
      ? [{ action, name: document.name, documentId: document.id, text }]
      : changes;
  const input = { sourceVersionId: version.id, changes: actualChanges, chunkSize, overlap };
  const valid =
    actualChanges.length > 0 &&
    (action !== "replace" || text.trim().length > 0) &&
    Number.isInteger(chunkSize) &&
    chunkSize >= 200 &&
    chunkSize <= 1600 &&
    Number.isInteger(overlap) &&
    overlap >= 0 &&
    overlap <= 400 &&
    overlap < chunkSize / 2;
  const title = { add: "新增文档", replace: "更新文档", remove: "从新版本移除文档" }[action];
  async function act(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "操作失败");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      isDismissable={!busy}
      showCloseButton={!busy}
      className={styles.modal}
    >
      <div className={styles.modalHeader}>
        <DialogTitle>{receipt ? "文档变更已提交" : title}</DialogTitle>
        <DialogDescription className="mt-2 text-xs">
          {document?.name ?? "保留基线中已有文档，追加新文件"} · 基线 {version.id.slice(0, 8)}
        </DialogDescription>
      </div>
      <div className={styles.modalBody}>
        <KnowledgeError message={error} />
        {receipt ? (
          <div className="space-y-3 py-5 text-center">
            <CheckCircle2 className="mx-auto text-[var(--success)]" size={36} />
            <p>已生成候选版本，关闭页面后继续处理。</p>
            <code className="block break-all text-xs">{receipt.id}</code>
            <p className={styles.muted}>不会自动激活；旧版本与已发布工作流保持不变。</p>
          </div>
        ) : preview ? (
          <>
            <div className={styles.summary}>
              <strong>
                变更后：{preview.documentCount} 份文档 · {preview.chunks.length} 段
              </strong>
            </div>
            <PagedChunks key={preview.digest} chunks={preview.chunks} />
            <div className={`${styles.confirmation} mt-4`}>
              <p>
                确认后新建完整候选版本，未提及的文档会保留。相同模型配置下，未变化片段的已确认向量会复用。
              </p>
              <p>新增或变化片段将发送到此库的向量模型，可能产生调用费用。就绪后仍需手动激活。</p>
            </div>
          </>
        ) : (
          <fieldset disabled={busy || loading} className="space-y-5">
            <p className={styles.inlineNotice}>
              基于当前选择的历史版本创建候选，不合并其他候选中的改动。
              {action === "remove"
                ? "只在新版本中移除该文档，旧版本中的正文与引用仍保留。"
                : "其他文档自动保留，不需要重复上传。"}
            </p>
            {action === "add" && (
              <label className={styles.field}>
                <span>新增 TXT / Markdown</span>
                <input
                  type="file"
                  aria-label="新增文档文件"
                  accept=".txt,.md"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    if (!files.length) return;
                    setChanges([]);
                    void act(async () =>
                      setChanges(
                        (await readKnowledgeFiles(files, quotas)).map((file) => ({
                          action: "add",
                          ...file,
                        })),
                      ),
                    );
                  }}
                />
                <small>
                  每版本最多 {quotas.maxDocuments} 份、合计 {quotas.maxVersionBytes / 1024}{" "}
                  KiB；包括已有文档。
                </small>
                {changes.map((change) => (
                  <p key={change.name}>{change.name}</p>
                ))}
              </label>
            )}
            {action === "replace" && (
              <label className={styles.field}>
                <span>文档正文</span>
                {loading ? (
                  <p role="status">正在读取原文…</p>
                ) : (
                  <textarea
                    aria-label="文档正文"
                    className={`${styles.control} min-h-64 font-mono text-sm`}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                  />
                )}
                <small>
                  按纯文本编辑；文件名保持不变，单篇最多 {quotas.maxDocumentBytes / 1024} KiB。
                </small>
              </label>
            )}
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>分段长度</span>
                <input
                  aria-label="变更分段长度"
                  className={styles.control}
                  type="number"
                  min={200}
                  max={1600}
                  value={chunkSize}
                  onChange={(event) => setChunkSize(Number(event.target.value))}
                />
              </label>
              <label className={styles.field}>
                <span>重叠字符</span>
                <input
                  aria-label="变更重叠字符"
                  className={styles.control}
                  type="number"
                  min={0}
                  max={400}
                  value={overlap}
                  onChange={(event) => setOverlap(Number(event.target.value))}
                />
              </label>
            </div>
            {version.chunkSize == null && (
              <p className={styles.muted}>
                旧版本未记录分段参数，请确认新参数；参数变化可能增加重新向量化的片段。
              </p>
            )}
          </fieldset>
        )}
      </div>
      <div className={styles.modalFooter}>
        <Button
          variant="outline"
          isDisabled={busy}
          onPress={() => {
            if (preview) setPreview(null);
            else onClose();
          }}
        >
          {receipt ? "关闭" : preview ? "返回修改" : "取消"}
        </Button>
        {!receipt && (
          <Button
            isDisabled={busy || loading || !valid}
            onPress={() =>
              void act(async () => {
                if (!preview) setPreview(await knowledgeApi.previewChanges(libraryId, input));
                else {
                  const created = await knowledgeApi.changeDocuments(libraryId, {
                    ...input,
                    previewDigest: preview.digest,
                  });
                  setReceipt(created);
                  setPreview(null);
                  await onChanged();
                }
              })
            }
          >
            {busy && <Loader2 className="animate-spin" />}
            {preview ? "确认变更并排队" : "预览新版本"}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
