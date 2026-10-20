"use client";
import {
  knowledgeApi,
  pilotQuotas,
  type KnowledgeDetail,
  type KnowledgeQuotas,
} from "@/features/knowledge/api";
import { useCallback, useEffect, useRef, useState } from "react";

export function useKnowledgeDetailPanel({
  id,
  indexAvailable,
  modelLabel,
  onChanged,
  onBack,
  quotas = pilotQuotas,
}: {
  id: string;
  indexAvailable: boolean;
  modelLabel: string;
  onChanged: () => Promise<void>;
  onBack: () => void;
  quotas?: KnowledgeQuotas;
}) {
  const [detail, setDetail] = useState<KnowledgeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("documents");
  const [documentVersion, setDocumentVersion] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const lockRef = useRef(false);
  const sequenceRef = useRef(0);
  const aliveRef = useRef(true);
  const load = useCallback(async () => {
    const request = ++sequenceRef.current;
    const next = await knowledgeApi.detail(id);
    if (aliveRef.current && request === sequenceRef.current)
      setDetail({
        ...next,
        versions: [...next.versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      });
  }, [id]);
  useEffect(() => {
    aliveRef.current = true;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        if (!lockRef.current) await load();
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "查询失败");
      }
      if (!cancelled) timer = setTimeout(() => void poll(), 2500);
    };
    void poll();
    return () => {
      cancelled = true;
      aliveRef.current = false;
      clearTimeout(timer);
    };
  }, [load]);

  async function run(action: () => Promise<void>) {
    if (lockRef.current) return false;
    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      await onChanged();
      return true;
    } catch (reason) {
      if (aliveRef.current) setError(reason instanceof Error ? reason.message : "操作失败");
      return false;
    } finally {
      lockRef.current = false;
      if (aliveRef.current) setBusy(false);
    }
  }

  return {
    id,
    indexAvailable,
    modelLabel,
    onChanged,
    onBack,
    quotas,
    detail,
    setDetail,
    error,
    setError,
    busy,
    setBusy,
    tab,
    setTab,
    documentVersion,
    setDocumentVersion,
    importOpen,
    setImportOpen,
    settingsOpen,
    setSettingsOpen,
    lockRef,
    sequenceRef,
    aliveRef,
    load,
    run,
  };
}
export type KnowledgeDetailPanelController = ReturnType<typeof useKnowledgeDetailPanel>;
