"use client";
import {
  knowledgeApi,
  pilotQuotas,
  type KnowledgeDocumentSummary,
  type KnowledgeQuotas,
  type KnowledgeVersion,
} from "@/features/knowledge/api";
import { useEffect, useState } from "react";

export function useDocumentsPanel({
  libraryId,
  versionId,
  activeVersion,
  versions,
  onVersionChange,
  onImport,
  onChanged = async () => {},
  quotas = pilotQuotas,
  indexAvailable = true,
}: {
  libraryId: string;
  versionId: string | null;
  activeVersion: string | null;
  versions: KnowledgeVersion[];
  onVersionChange: (id: string) => void;
  onImport: () => void;
  onChanged?: () => Promise<void>;
  quotas?: KnowledgeQuotas;
  indexAvailable?: boolean;
}) {
  const [documents, setDocuments] = useState<KnowledgeDocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<KnowledgeDocumentSummary | null>(null);
  const [change, setChange] = useState<{
    action: "add" | "replace" | "remove";
    document?: KnowledgeDocumentSummary;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!versionId) return;
    let cancelled = false;
    void knowledgeApi
      .documents(libraryId, versionId)
      .then((value) => {
        if (!cancelled) {
          setDocuments(value);
          setError(null);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setDocuments(null);
          setError(reason instanceof Error ? reason.message : "文档加载失败");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [libraryId, versionId, retry]);
  const filtered = (documents ?? []).filter((document) =>
    document.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const version = versions.find((item) => item.id === versionId);
  const canChange = version?.status === "ready" && indexAvailable;

  return {
    libraryId,
    versionId,
    activeVersion,
    versions,
    onVersionChange,
    onImport,
    onChanged,
    quotas,
    indexAvailable,
    documents,
    setDocuments,
    error,
    setError,
    query,
    setQuery,
    selected,
    setSelected,
    change,
    setChange,
    retry,
    setRetry,
    filtered,
    version,
    canChange,
  };
}
export type DocumentsPanelController = ReturnType<typeof useDocumentsPanel>;
