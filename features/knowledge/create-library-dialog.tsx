"use client";

import { useRef, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { knowledgeApi, type KnowledgeLibrary } from "./api";
import { KnowledgeError } from "./knowledge-ui";
import styles from "./knowledge.module.css";

export function CreateLibraryDialog({
  models,
  onClose,
  onCreated,
}: {
  models: { id: string; label: string }[];
  onClose: () => void;
  onCreated: (library: KnowledgeLibrary) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [modelId, setModelId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  async function submit() {
    if (lock.current || !name.trim() || !modelId) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      onCreated(
        await knowledgeApi.create({ name: name.trim(), description: description.trim(), modelId }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "新建失败");
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
      className={`${styles.modal} !w-[min(540px,calc(100vw-32px))]`}
    >
      <div className={styles.modalHeader}>
        <DialogTitle>新建知识库</DialogTitle>
        <DialogDescription className="mt-2 text-xs">
          先定义用途和向量模型，再导入文档。
        </DialogDescription>
      </div>
      <form
        className="flex min-h-0 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className={styles.modalBody}>
          <KnowledgeError message={error} />
          <label className={styles.field}>
            <span>
              知识库名称 <span className="text-destructive">*</span>
            </span>
            <input
              autoFocus
              required
              maxLength={80}
              className={styles.control}
              placeholder="例如：产品使用手册"
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>
              用途说明 <span className="font-normal text-muted-foreground">选填</span>
            </span>
            <textarea
              rows={2}
              maxLength={1000}
              className={styles.control}
              placeholder="描述这份知识可以解决哪些问题，方便后续管理"
              value={description}
              disabled={busy}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>
              向量模型 <span className="text-destructive">*</span>
            </span>
            <select
              required
              className={styles.control}
              value={modelId}
              disabled={busy}
              onChange={(event) => setModelId(event.target.value)}
            >
              <option value="">选择向量模型</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
            <small>
              请先在渠道管理中保存模型的实测维度。文档与检索问题使用同一模型；创建知识库本身不调用模型。
            </small>
          </label>
          {models.length === 0 && (
            <p className={styles.inlineNotice}>
              暂无可用的向量模型。请先在渠道管理中启用 openai-embeddings 模型，再返回创建。
            </p>
          )}
          <p className={styles.muted}>当前仅管理员可用，不自动开放给用户或外部 API。</p>
        </div>
        <div className={styles.modalFooter}>
          <Button variant="outline" isDisabled={busy} onPress={onClose}>
            取消
          </Button>
          <Button
            type="submit"
            isDisabled={busy || !name.trim() || !modelId}
            className={styles.primary}
          >
            {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}创建知识库
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
