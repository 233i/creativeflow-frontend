"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { knowledgeApi } from "@/features/knowledge/api";
import type { KnowledgeDetailPanelController } from "@/features/knowledge/controllers/use-knowledge-detail";
import { CopyId, KnowledgeError } from "@/features/knowledge/knowledge-ui";
import styles from "@/features/knowledge/knowledge.module.css";
import { knowledgeVersionView } from "@/features/knowledge/version-selection";
import { Loader2 } from "lucide-react";
export function KnowledgeSettingsDialog({
  controller,
}: {
  controller: KnowledgeDetailPanelController & ReturnType<typeof knowledgeVersionView>;
}) {
  const { id, modelLabel, error, busy, setSettingsOpen, run, library } = controller;
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open && !busy) setSettingsOpen(false);
      }}
      isDismissable={!busy}
      showCloseButton={!busy}
      className={`${styles.modal} !w-[min(540px,calc(100vw-32px))]`}
    >
      <div className={styles.modalHeader}>
        <DialogTitle>知识库设置</DialogTitle>
        <DialogDescription className="mt-2 text-xs">{library.name}</DialogDescription>
      </div>
      <div className={styles.modalBody}>
        <KnowledgeError message={error} />
        <label className={styles.field}>
          <span>知识库 ID</span>
          <CopyId id={id} />
        </label>
        <label className={styles.field}>
          <span>向量模型</span>
          <p>{modelLabel}</p>
          <small>
            当前知识库绑定此模型。更换模型或配置后需重新建立兼容的版本，不能混用旧索引。
          </small>
        </label>
        <div className={styles.confirmation}>
          <h4>{library.enabled ? "停用此知识库" : "重新启用此知识库"}</h4>
          <p>
            {library.enabled
              ? "停用后会阻止新检索与片段读取，不删除历史版本和向量。已发出的模型请求无法撤回；未完成的批次可能中止，需启用后手动恢复。"
              : "启用后，管理员检索和既有账号授权重新生效。不自动新增授权，也不会重新向量化。"}
          </p>
        </div>
      </div>
      <div className={styles.modalFooter}>
        <Button variant="outline" isDisabled={busy} onPress={() => setSettingsOpen(false)}>
          取消
        </Button>
        <Button
          variant={library.enabled ? "destructive" : "default"}
          isDisabled={busy}
          onPress={async () => {
            if (await run(() => knowledgeApi.enabled(id, !library.enabled))) setSettingsOpen(false);
          }}
        >
          {busy && <Loader2 className="animate-spin" />}
          {library.enabled ? "确认停用知识库" : "启用知识库"}
        </Button>
      </div>
    </Dialog>
  );
}
