"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { KnowledgePermissionsPanelController } from "@/features/knowledge/controllers/use-knowledge-permissions";
import { KnowledgeError } from "@/features/knowledge/knowledge-ui";
import styles from "@/features/knowledge/knowledge.module.css";
export function AccountGrantDialog({
  controller,
}: {
  controller: KnowledgePermissionsPanelController;
}) {
  const { reason, setReason, pending, setPending, error, busy, confirm } = controller;
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
        <DialogTitle>{pending.enabled ? "确认授权" : "确认撤权"}</DialogTitle>
        <DialogDescription className="mt-2">
          {pending.name} ·{" "}
          {pending.enabled ? "检索、问答与命中片段读取" : "包括已完成运行的后续读取及复用"}
        </DialogDescription>
      </div>
      <div className={styles.modalBody}>
        <KnowledgeError message={error} />
        <label className={styles.field}>
          <span>调整原因 *</span>
          <textarea
            aria-label="授权调整原因"
            className={styles.control}
            maxLength={300}
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      </div>
      <div className={styles.modalFooter}>
        <Button variant="outline" isDisabled={busy} onPress={() => setPending(null)}>
          取消
        </Button>
        <Button
          variant={pending.enabled ? "default" : "destructive"}
          isDisabled={busy || !reason.trim()}
          onPress={() => void confirm()}
        >
          确认{pending.enabled ? "授权" : "撤权"}
        </Button>
      </div>
    </Dialog>
  );
}
