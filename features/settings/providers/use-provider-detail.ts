"use client";
import { useT } from "@/components/providers/i18n-provider";
import * as api from "@/features/ai/api";
import { findPreset, presetRequiresApiKey } from "@/features/ai/presets";
import { useAiStore } from "@/features/ai/store";
import { type AiProvider, normalizeBaseUrl } from "@/features/ai/types";
import { useMemo, useState } from "react";
import { useProviderCommands } from "./use-provider-commands";

export function useProviderDetail(provider: AiProvider) {
  const t = useT();
  const { updateProvider, updateModel, setAllModelsEnabled, saveProvider, saving, error } =
    useProviderCommands(provider.id);
  const deleteProvider = useAiStore((state) => state.deleteProvider);
  const deleteModel = useAiStore((state) => state.deleteModel);
  const refreshAdmin = useAiStore((state) => state.refreshAdmin);

  const preset = findPreset(provider.builtinId);
  const requiresKey =
    provider.type !== "openai-embeddings" && presetRequiresApiKey(provider.builtinId);
  const isBuiltin = Boolean(provider.builtinId);

  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [embeddingModelId, setEmbeddingModelId] = useState<string | null>(null);
  const [rerankModelId, setRerankModelId] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl);
  const [check, setCheck] = useState<api.ProviderCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);
  const [modelQuery, setModelQuery] = useState("");
  const [editingModel, setEditingModel] = useState<string | "new" | null>(null);
  const [deletingProvider, setDeletingProvider] = useState(false);
  const [deletingModelId, setDeletingModelId] = useState<string | null>(null);

  const visibleModels = useMemo(() => {
    const q = modelQuery.trim().toLowerCase();
    return q
      ? provider.models.filter(
          (m) => m.modelKey.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
        )
      : provider.models;
  }, [provider.models, modelQuery]);

  async function saveApiKey() {
    if (!apiKeyDraft) return;
    if (await saveProvider({ apiKey: apiKeyDraft })) {
      setApiKeyDraft("");
      setShowKey(false);
      setCheck(null);
    }
  }

  async function saveBaseUrl() {
    const normalized = normalizeBaseUrl(baseUrl, provider.type);
    if (normalized === provider.baseUrl) return;

    if (await saveProvider({ baseUrl: normalized })) {
      setBaseUrl(normalized);
    }
  }

  async function runCheck() {
    setChecking(true);
    setCheck(null);
    try {
      setCheck(await api.checkProvider(provider.id));
    } catch {
      setCheck({ ok: false, statusCode: null, error: t("errors.networkError"), modelCount: null });
    } finally {
      setChecking(false);
    }
  }

  /**
   * 获取供应商目录并添加所有缺失项。
   *
   * 服务器导入只添加缺失项，因此重复执行绝不会创建重复模型或丢弃单模型编辑。
   * 供应商发布新内容时，用户正是通过此按钮更新，因此这一点很重要。
   */
  async function fetchModels() {
    setFetching(true);
    setFetchMessage(null);
    try {
      const { models } = await api.fetchUpstreamModels(provider.id);
      if (models.length === 0) {
        setFetchMessage(t("provider.fetchedModels", { count: 0 }));
        return;
      }

      const { added } = await api.importModels(
        provider.id,
        models.map((model) => ({
          modelKey: model.modelKey,
          name: model.name,
          category: model.category,
          enabled: false,
        })),
      );

      setFetchMessage(t("provider.fetchedModels", { count: added }));
      // 渠道管理使用管理员会话，不能刷新依赖普通用户会话的 MCP 列表。
      await refreshAdmin();
    } catch (error) {
      setFetchMessage(
        error instanceof api.AiApiError
          ? (error.details[0] ?? error.message)
          : t("errors.networkError"),
      );
    } finally {
      setFetching(false);
    }
  }

  return {
    provider,
    t,
    updateProvider,
    deleteProvider,
    setAllModelsEnabled,
    updateModel,
    deleteModel,
    refreshAdmin,
    preset,
    requiresKey,
    isBuiltin,
    apiKeyDraft,
    setApiKeyDraft,
    embeddingModelId,
    setEmbeddingModelId,
    rerankModelId,
    setRerankModelId,
    showKey,
    setShowKey,
    baseUrl,
    setBaseUrl,
    saving,
    error,
    check,
    setCheck,
    checking,
    setChecking,
    fetching,
    setFetching,
    fetchMessage,
    setFetchMessage,
    modelQuery,
    setModelQuery,
    editingModel,
    setEditingModel,
    deletingProvider,
    setDeletingProvider,
    deletingModelId,
    setDeletingModelId,
    visibleModels,
    saveApiKey,
    saveBaseUrl,
    runCheck,
    fetchModels,
  };
}
export type ProviderDetailController = ReturnType<typeof useProviderDetail>;
