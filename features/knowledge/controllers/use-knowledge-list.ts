"use client";
import { useAiStore } from "@/features/ai/store";
import { resolveProtocol } from "@/features/ai/types";
import {
  knowledgeApi,
  type KnowledgeCapabilities,
  type KnowledgeLibrary,
} from "@/features/knowledge/api";
import { useCallback, useEffect, useState } from "react";

export function useKnowledgePanel() {
  const providers = useAiStore((state) => state.providers);
  const allModels = providers.flatMap((provider) =>
    provider.models.map((model) => ({
      id: model.id,
      label: `${provider.name} · ${model.name}`,
      available:
        provider.enabled &&
        model.enabled &&
        model.category === "embedding" &&
        resolveProtocol(provider, model) === "openai-embeddings",
    })),
  );
  const [capabilities, setCapabilities] = useState<KnowledgeCapabilities | null>(null);
  const [libraries, setLibraries] = useState<KnowledgeLibrary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const load = useCallback(async () => setLibraries(await knowledgeApi.list()), []);

  useEffect(() => {
    let cancelled = false;
    void knowledgeApi
      .capabilities()
      .then(async (value) => {
        if (cancelled) return;
        setCapabilities(value);
        if (value.enabled) {
          const list = await knowledgeApi.list();
          if (!cancelled) setLibraries(list);
        }
        if (!cancelled) {
          setError(null);
          setLoading(false);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "知识库加载失败");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [retry]);

  const activeCount = libraries.filter(
    (library) => library.enabled && library.activeVersion,
  ).length;
  const inactiveCount = libraries.filter((library) => !library.enabled).length;
  const filtered = libraries.filter((library) => {
    const matches = `${library.name} ${library.description}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    return (
      matches &&
      (filter === "all" ||
        (filter === "active" ? library.enabled && !!library.activeVersion : !library.enabled))
    );
  });
  const chosen = libraries.find((library) => library.id === selected);
  const labelFor = (modelId: string) =>
    allModels.find((model) => model.id === modelId)?.label ?? "模型不可用或已移除";

  return {
    providers,
    allModels,
    capabilities,
    setCapabilities,
    libraries,
    setLibraries,
    selected,
    setSelected,
    creating,
    setCreating,
    query,
    setQuery,
    filter,
    setFilter,
    loading,
    setLoading,
    error,
    setError,
    retry,
    setRetry,
    load,
    activeCount,
    inactiveCount,
    filtered,
    chosen,
    labelFor,
  };
}
export type KnowledgePanelController = ReturnType<typeof useKnowledgePanel>;
