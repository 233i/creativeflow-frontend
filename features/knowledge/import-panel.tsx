"use client";
import { ImportDocumentsStep } from "@/features/knowledge/components/import-documents-step";
import { ImportStepActions } from "@/features/knowledge/components/import-step-actions";
import { useKnowledgeImportPanel } from "@/features/knowledge/controllers/use-knowledge-import";

import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Check, CheckCircle2, FileText } from "lucide-react";
import { pilotQuotas, type KnowledgeQuotas } from "./api";
import { KnowledgeError, PagedChunks } from "./knowledge-ui";
import styles from "./knowledge.module.css";

export { ChunkList } from "./knowledge-ui";

/** 三步确认入库；返回编辑就废弃摘要，只有最后确认才发送向量化任务。 */
export function KnowledgeImportPanel({
  libraryId,
  indexAvailable,
  onImported,
  onClose,
  libraryName = "当前知识库",
  quotas = pilotQuotas,
}: {
  libraryId: string;
  indexAvailable: boolean;
  onImported: () => void | Promise<void>;
  onClose: () => void;
  libraryName?: string;
  quotas?: KnowledgeQuotas;
}) {
  const controller = useKnowledgeImportPanel({
    libraryId,
    indexAvailable,
    onImported,
    onClose,
    libraryName,
    quotas,
  });
  const { documents, chunkSize, overlap, preview, step, receipt, error, busy } = controller;
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
        <DialogTitle>{receipt ? "入库任务已提交" : "导入文档"}</DialogTitle>
        <DialogDescription className="mt-2 text-xs">
          {libraryName} · 新建一个完整的知识版本
        </DialogDescription>
      </div>
      {!receipt && (
        <ol className={styles.steps} aria-label="导入步骤">
          {["选择文档", "预览分段", "确认入库"].map((label, index) => (
            <li key={label} aria-current={step === index ? "step" : undefined}>
              <span className={styles.stepNumber}>
                {step > index ? <Check size={12} aria-hidden /> : index + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
      )}
      <div className={styles.modalBody}>
        <KnowledgeError message={error} />
        {receipt ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto mb-4 size-12 text-[var(--success)]" aria-hidden />
            <h3 className="text-lg font-semibold">可以关掉弹窗，任务会继续处理</h3>
            <p className="my-3 text-sm text-muted-foreground">
              到「索引版本」查看进度。就绪后，仍需你手动激活。
            </p>
            <p className={styles.muted}>任务 ID：{receipt.id}</p>
          </div>
        ) : (
          <>
            {step === 0 && <ImportDocumentsStep controller={controller} />}
            {step === 1 && preview && (
              <>
                <div className={styles.summary} role="status">
                  <strong>
                    {preview.documentCount} 份文档 · {preview.chunks.length} 个片段
                  </strong>
                  <span className={styles.muted}>
                    段长 {chunkSize} · 重叠 {overlap} · 最多 {quotas.maxChunks} 段
                  </span>
                </div>
                <PagedChunks key={preview.digest} chunks={preview.chunks} />
                <p className={`${styles.muted} mt-4`}>
                  检查内容完整性与上下文衔接；需要调整时，返回上一步重新预览。
                </p>
              </>
            )}
            {step === 2 && preview && (
              <>
                <div className={styles.summary}>
                  <span>
                    <strong>{preview.documentCount}</strong> 份文档
                  </span>
                  <span>
                    <strong>{preview.chunks.length}</strong> 个片段
                  </span>
                  <span>Cosine 相似度</span>
                </div>
                <div className={styles.confirmation}>
                  <h4>这次导入将创建完整的新版本</h4>
                  <p>
                    请包含希望保留的全部文档。新版本不会自动生效；手动激活后，会整体替换当前检索版本，而不是追加文档。
                  </p>
                  <p>
                    确认后，文档正文将发送至此知识库绑定的向量模型，可能产生模型调用费用。关闭页面不取消任务。
                  </p>
                </div>
                <div className="mt-5 space-y-2">
                  {documents.map((document) => (
                    <p key={document.name} className="flex items-center gap-2 text-xs">
                      <FileText size={14} aria-hidden />
                      {document.name}
                    </p>
                  ))}
                </div>
              </>
            )}
            {!indexAvailable && (
              <p className={`${styles.inlineNotice} mt-4`}>
                索引服务未配置，当前只能预览分段，不能提交入库。
              </p>
            )}
          </>
        )}
      </div>
      <ImportStepActions controller={controller} />
    </Dialog>
  );
}
