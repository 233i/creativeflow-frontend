"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { KnowledgeKeyPermissionsController } from "@/features/knowledge/controllers/use-knowledge-key-permissions";
import { KnowledgeError } from "@/features/knowledge/knowledge-ui";
import styles from "@/features/knowledge/knowledge.module.css";
export function KeyGrantDialog({ controller }: { controller: KnowledgeKeyPermissionsController }) {
  const { pending, setPending, reason, setReason, busy, error, confirm } = controller;
  if (!pending) return null;
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open && !busy) setPending(null);
      }}
      isDismissable={!busy}
      showCloseButton={!busy}
      className={styles.modal}
    >
      <div className={styles.modalHeader}>
        <DialogTitle>{pending.enabled ? "确认 Key 授权" : "确认 Key 撤权"}</DialogTitle>
        <DialogDescription className="mt-2">
          {pending.name} ·{" "}
          {pending.enabled
            ? "允许固定版本检索、问答和读取结果。"
            : "后续执行及旧结果读取将被拒绝，无法撤回对方已保存的数据。"}
        </DialogDescription>
      </div>
      <div className={styles.modalBody}>
        <KnowledgeError message={error} />
        <label className={styles.field}>
          <span>调整原因 *</span>
          <textarea
            aria-label="Key 授权调整原因"
            className={styles.control}
            rows={3}
            maxLength={300}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      </div>
      <div className={styles.modalFooter}>
        <Button variant="outline" isDisabled={busy} onPress={() => setPending(null)}>
          取消
        </Button>
        <Button isDisabled={busy || !reason.trim()} onPress={() => void confirm()}>
          确认{pending.enabled ? "授权" : "撤权"}
        </Button>
      </div>
    </Dialog>
  );
}
