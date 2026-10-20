"use client";
import {
  knowledgeApi,
  pilotQuotas,
  readKnowledgeFiles,
  type KnowledgeDocument,
  type KnowledgePreview,
  type KnowledgeQuotas,
  type KnowledgeVersion,
} from "@/features/knowledge/api";
import { useRef, useState } from "react";

export function useKnowledgeImportPanel({
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
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [chunkSize, setChunkSize] = useState(800);
  const [overlap, setOverlap] = useState(100);
  const [preview, setPreview] = useState<KnowledgePreview | null>(null);
  const [step, setStep] = useState(0);
  const [receipt, setReceipt] = useState<KnowledgeVersion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const lockRef = useRef(false);
  const validParameters =
    Number.isInteger(chunkSize) &&
    chunkSize >= 200 &&
    chunkSize <= 1600 &&
    Number.isInteger(overlap) &&
    overlap >= 0 &&
    overlap <= 400 &&
    overlap < chunkSize / 2;

  async function act(action: () => Promise<void>) {
    if (lockRef.current) return;
    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "操作失败");
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  }

  function choose(files: File[]) {
    if (lockRef.current || files.length === 0) return;
    setPreview(null);
    setDocuments([]);
    void act(async () => setDocuments(await readKnowledgeFiles(files, quotas)));
  }

  function previewDocuments() {
    void act(async () => {
      setPreview(await knowledgeApi.preview({ documents, chunkSize, overlap }));
      setStep(1);
    });
  }
  function importDocuments() {
    void act(async () => {
      if (!preview) return;
      const submitted = await knowledgeApi.import(libraryId, {
        documents,
        chunkSize,
        overlap,
        previewDigest: preview.digest,
      });
      // 成功回执先落入界面状态，刷新详情失败也不能再次发送导入请求。
      setReceipt(submitted);
      setPreview(null);
      await onImported();
    });
  }
  return {
    previewDocuments,
    importDocuments,
    libraryId,
    indexAvailable,
    onImported,
    onClose,
    libraryName,
    quotas,
    documents,
    setDocuments,
    chunkSize,
    setChunkSize,
    overlap,
    setOverlap,
    preview,
    setPreview,
    step,
    setStep,
    receipt,
    setReceipt,
    error,
    setError,
    busy,
    setBusy,
    dragging,
    setDragging,
    lockRef,
    validParameters,
    act,
    choose,
  };
}
export type KnowledgeImportPanelController = ReturnType<typeof useKnowledgeImportPanel>;
