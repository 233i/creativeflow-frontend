"use client";
import { useEffect, useRef, useState } from "react";
import { knowledgeApi, type KnowledgeSearch } from "../api";
import {
  defaultRetrievalSettings,
  retrievalError,
  type RetrievalSettings,
} from "../retrieval-types";

/** 显式测试且防重复提交；改动参数或切换固定版本后不展示旧收据。 */
export function useKnowledgeSearch({
  libraryId,
  activeVersion,
  enabled,
  indexAvailable,
  hybridAvailable,
}: {
  libraryId: string;
  activeVersion: string | null;
  enabled: boolean;
  indexAvailable: boolean;
  hybridAvailable: boolean;
}) {
  const [query, setQuery] = useState("");
  const [original, setOriginal] = useState("");
  const [settings, setSettings] = useState<RetrievalSettings>({
    ...defaultRetrievalSettings,
    mode: hybridAvailable ? "hybrid" : "vector",
  });
  const [result, setResult] = useState<KnowledgeSearch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const disabledReason = !enabled
    ? "知识库已停用，启用后才能测试。"
    : !indexAvailable
      ? "索引服务未配置，暂时无法检索。"
      : !activeVersion
        ? "先导入文档并激活就绪版本。"
        : null;
  const valid = !disabledReason && !!query.trim() && !retrievalError(settings, hybridAvailable);
  function changeSettings(value: RetrievalSettings) {
    setSettings(value);
    setResult(null);
    setError(null);
  }
  async function search() {
    if (lock.current || !valid) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const next = await knowledgeApi.search(
        libraryId,
        query,
        settings.topK,
        settings,
        original.trim() ? original : undefined,
      );
      if (alive.current) {
        if (next.versionId === activeVersion) setResult(next);
        else setError("激活版本已变化，请刷新后重新测试。");
      }
    } catch (reason) {
      if (alive.current) setError(reason instanceof Error ? reason.message : "检索失败");
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return {
    query,
    setQuery: (next: string) => {
      setQuery(next);
      setResult(null);
    },
    original,
    setOriginal: (next: string) => {
      setOriginal(next);
      setResult(null);
    },
    settings,
    changeSettings,
    result,
    error,
    busy,
    disabledReason,
    valid,
    search,
  };
}
