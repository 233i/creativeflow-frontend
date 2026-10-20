"use client";
import { Button } from "@/components/ui/button";
import type { KnowledgeImportPanelController } from "@/features/knowledge/controllers/use-knowledge-import";
import styles from "@/features/knowledge/knowledge.module.css";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
export function ImportStepActions({ controller }: { controller: KnowledgeImportPanelController }) {
  const {
    previewDocuments,
    importDocuments,
    indexAvailable,
    onClose,
    documents,
    preview,
    setPreview,
    step,
    setStep,
    receipt,
    setError,
    busy,
    validParameters,
  } = controller;
  return (
    <div className={styles.modalFooter}>
      {receipt ? (
        <>
          <span className={styles.muted}>不会自动重新提交或激活</span>
          <Button onPress={onClose}>
            查看任务 <ArrowRight />
          </Button>
        </>
      ) : (
        <>
          <Button
            variant="outline"
            isDisabled={busy}
            onPress={() => {
              if (step === 0) onClose();
              else {
                setStep(step - 1);
                setError(null);
                if (step === 1) setPreview(null);
              }
            }}
          >
            {step === 0 ? (
              "取消"
            ) : (
              <>
                <ArrowLeft />
                上一步
              </>
            )}
          </Button>
          {step === 0 ? (
            <Button
              className={styles.primary}
              isDisabled={busy || !documents.length || !validParameters}
              onPress={() => previewDocuments()}
            >
              {busy && <Loader2 className="animate-spin" />}预览分段 <ArrowRight />
            </Button>
          ) : step === 1 ? (
            <Button className={styles.primary} onPress={() => setStep(2)}>
              下一步：确认入库 <ArrowRight />
            </Button>
          ) : (
            <Button
              className={styles.primary}
              isDisabled={!indexAvailable || busy || !preview}
              onPress={() => importDocuments()}
            >
              {busy && <Loader2 className="animate-spin" />}确认并排队入库
            </Button>
          )}
        </>
      )}
    </div>
  );
}
