"use client";
import { useEffect, useRef, useState } from "react";
import {
  rerankApi,
  type RerankConfiguration,
  type RerankSettings,
  type RerankTestResult,
} from "@/features/ai/rerank-api";
import { message } from "./embedding-errors";
import { useWorkspaceGuard } from "@/components/providers/workspace-context";

/** 测试只调用已保存版本；请求锁阻止快速重复点击，不自动重试。 */
export function useRerankModel(modelId: string) {
  const [saved, setSaved] = useState<RerankConfiguration | null>(null);
  const [draft, setDraft] = useState<RerankSettings | null>(null);
  const [query, setQuery] = useState("CreativeFlow 支持哪些工作流？");
  const [documentsText, setDocuments] = useState(
    "CreativeFlow 支持媒体创作和通用编排工作流。\n本产品的保修期限为三年。",
  );
  const [result, setResult] = useState<RerankTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  const testRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    const abort = new AbortController();
    void rerankApi
      .settings(modelId, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) {
          setSaved(value);
          setDraft(value.settings);
        }
      })
      .catch((reason) => {
        if (!abort.signal.aborted) setError(message(reason));
      });
    return () => {
      alive.current = false;
      abort.abort();
      testRequest.current?.abort();
    };
  }, [modelId]);
  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved.settings);
  useWorkspaceGuard({ dirty, busy, save });
  const documents = documentsText
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  function change<K extends keyof RerankSettings>(key: K, value: RerankSettings[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setResult(null);
    setError(null);
  }
  async function execute(action: () => Promise<void>) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      await action();
      return true;
    } catch (reason) {
      if (alive.current) setError(message(reason));
      return false;
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function save() {
    if (!draft) return Promise.resolve(false);
    return execute(async () => {
      const value = await rerankApi.save(modelId, draft);
      if (alive.current) {
        setSaved(value);
        setDraft(value.settings);
      }
    });
  }
  function test() {
    if (!saved?.version || dirty || !query.trim() || documents.length === 0)
      return Promise.resolve();
    return execute(async () => {
      const abort = new AbortController();
      testRequest.current = abort;
      const value = await rerankApi.test(modelId, query, documents, abort.signal);
      if (alive.current) setResult(value);
    });
  }
  return {
    saved,
    draft,
    dirty,
    query,
    setQuery: (value: string) => {
      setQuery(value);
      setResult(null);
    },
    documentsText,
    setDocuments: (value: string) => {
      setDocuments(value);
      setResult(null);
    },
    documents,
    result,
    error,
    busy,
    change,
    save,
    test,
  };
}
