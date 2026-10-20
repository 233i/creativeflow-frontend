"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { knowledgeApi, type CleanupPreview } from "./api";
import { KnowledgeError } from "./knowledge-ui";
import styles from "./knowledge.module.css";

/** 预检与确认分离；成功提交后刷新失败也不会重复清理请求。 */
export function CleanupDialog({
  libraryId,
  versionId,
  onClose,
  onChanged,
}: {
  libraryId: string;
  versionId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let disposed = false;
    void knowledgeApi
      .cleanupPreview(libraryId, versionId)
      .then((value) => {
        if (!disposed) setPreview(value);
      })
      .catch((reason) => {
        if (!disposed) setError(reason instanceof Error ? reason.message : "预检失败");
      });
    return () => {
      disposed = true;
    };
  }, [libraryId, versionId]);
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      isDismissable={!busy}
      showCloseButton={!busy}
      className={`${styles.modal} !w-[min(560px,calc(100vw-32px))]`}
    >
      <div className={styles.modalHeader}>
        <DialogTitle>{submitted ? "清理任务已提交" : "清理未引用版本"}</DialogTitle>
        <DialogDescription className="mt-2 break-all text-xs">版本 {versionId}</DialogDescription>
      </div>
      <div className={styles.modalBody}>
        <KnowledgeError message={error} />
        {submitted ? (
          <p>
            后台会删除该版本的向量集合、片段和不再被其他版本使用的原文。失败时保留资料，可在索引版本中明确重试。
          </p>
        ) : !preview ? (
          <p role="status">检查激活状态与持久引用…</p>
        ) : (
          <>
            <div className={styles.confirmation}>
              <p>
                {preview.allowed
                  ? "当前无引用，可以申请清理。提交时服务器会再次核对。"
                  : preview.reason}
              </p>
              <p>
                草稿、模板、发布版本和运行历史的引用：{preview.referenceCount}
                。停用发布不会解除历史引用。
              </p>
              <p>
                可释放逻辑预留约 {(preview.reservedBytes / 1048576).toFixed(2)}{" "}
                MiB，并非服务器物理磁盘预测值。
              </p>
              <p>
                <strong>完成后无法从应用恢复此版本。</strong> 清理原因与版本摘要会保留。
              </p>
            </div>
            {preview.allowed && (
              <label className={`${styles.field} mt-4`}>
                <span>清理原因</span>
                <textarea
                  aria-label="清理原因"
                  className={styles.control}
                  maxLength={300}
                  value={reason}
                  disabled={busy}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
            )}
          </>
        )}
      </div>
      <div className={styles.modalFooter}>
        <Button variant="outline" isDisabled={busy} onPress={onClose}>
          {submitted ? "关闭" : "取消"}
        </Button>
        {!submitted && (
          <Button
            variant="destructive"
            isDisabled={busy || !preview?.allowed || !reason.trim()}
            onPress={async () => {
              if (lock.current) return;
              lock.current = true;
              setBusy(true);
              setError(null);
              try {
                await knowledgeApi.cleanup(libraryId, versionId, reason.trim());
                setSubmitted(true);
                await onChanged();
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "清理提交失败");
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }}
          >
            确认清理此版本
          </Button>
        )}
      </div>
    </Dialog>
  );
}
