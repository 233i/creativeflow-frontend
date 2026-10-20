"use client";
import { useT } from "@/components/providers/i18n-provider";
import {
  getEmbeddingSettings,
  saveEmbeddingSettings,
  testEmbeddingModel,
  type EmbeddingConfiguration,
  type EmbeddingSettings,
  type EmbeddingTestResult,
} from "@/features/ai/embedding-api";
import { resolveProtocol, type AiModel, type AiProvider } from "@/features/ai/types";
import { message } from "@/features/settings/models/embedding-errors";
import { useEffect, useRef, useState } from "react";

export function useEmbeddingModel({
  provider,
  model,
  onClose,
}: {
  provider: AiProvider;
  model: AiModel;
  onClose: () => void;
}) {
  const t = useT();
  const [saved, setSaved] = useState<EmbeddingConfiguration | null>(null);
  const [draft, setDraft] = useState<EmbeddingSettings | null>(null);
  const [inputs, setInputs] = useState(
    "CreativeFlow 支持图片和视频工作流。\n向量模型将文本转换为数值向量。",
  );
  const [purpose, setPurpose] = useState<"document" | "query">("document");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EmbeddingTestResult | null>(null);
  const activeTest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getEmbeddingSettings(model.id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setSaved(value);
          setDraft(value.settings);
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(message(failure));
      });
    return () => {
      controller.abort();
      activeTest.current?.abort();
    };
  }, [model.id]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved?.settings);
  const protocolReady = resolveProtocol(provider, model) === "openai-embeddings";
  const texts = inputs
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const canTest =
    !!saved?.version &&
    !dirty &&
    protocolReady &&
    provider.enabled &&
    model.enabled &&
    !!draft &&
    texts.length > 0 &&
    texts.length <= draft.maxBatchSize &&
    !busy;

  function change<K extends keyof EmbeddingSettings>(key: K, value: EmbeddingSettings[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setResult(null);
  }

  async function save() {
    if (!draft || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const value = await saveEmbeddingSettings(model.id, draft);
      setSaved(value);
      setDraft(value.settings);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    if (!canTest) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const controller = new AbortController();
    activeTest.current = controller;
    try {
      setResult(await testEmbeddingModel(model.id, texts, purpose, controller.signal));
    } catch (failure) {
      if (!controller.signal.aborted) setError(message(failure));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      activeTest.current = null;
    }
  }

  return {
    provider,
    model,
    onClose,
    t,
    saved,
    setSaved,
    draft,
    setDraft,
    inputs,
    setInputs,
    purpose,
    setPurpose,
    busy,
    setBusy,
    error,
    setError,
    result,
    setResult,
    activeTest,
    dirty,
    protocolReady,
    texts,
    canTest,
    change,
    save,
    test,
  };
}
export type EmbeddingModelDialogController = ReturnType<typeof useEmbeddingModel>;
