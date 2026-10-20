"use client";

import { create } from "zustand";
import * as api from "@/features/ai/api";
import type { AiProvider, ModelCategory } from "@/features/ai/types";
import { enabledModels, resolveProtocol } from "@/features/ai/types";

/**
 * 供应商和模型配置为应用级，由管理员拥有。普通用户只能读取；下方修改方法调用独立管理 API，
 * 且只由管理后台挂载。MCP 服务器仍按账户或设备限定作用域。
 */

export type SlotKind = api.ModelSlotKind;

export interface ModelSlot {
  providerId: string | null;
  modelId: string | null;
}

const EMPTY_SLOT: ModelSlot = { providerId: null, modelId: null };

function emptySlots(): Record<SlotKind, ModelSlot> {
  return {
    chat: EMPTY_SLOT,
    fast: EMPTY_SLOT,
    image: EMPTY_SLOT,
    video: EMPTY_SLOT,
  };
}

function toSlots(entries: api.ModelSlotResponse[]): Record<SlotKind, ModelSlot> {
  const slots = emptySlots();
  for (const entry of entries) {
    slots[entry.kind] = {
      providerId: entry.providerId,
      modelId: entry.modelId,
    };
  }
  return slots;
}

let providerLoadPromise: Promise<void> | null = null;

interface AiState {
  providers: AiProvider[];
  mcpServers: api.McpServer[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  slots: Record<SlotKind, ModelSlot>;

  load: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshAdmin: () => Promise<void>;

  createProvider: (input: api.CreateProviderInput) => Promise<AiProvider>;
  updateProvider: (id: string, input: api.UpdateProviderInput) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;

  addModel: (providerId: string, input: api.CreateModelInput) => Promise<void>;
  updateModel: (modelId: string, input: api.UpdateModelInput) => Promise<void>;
  deleteModel: (modelId: string) => Promise<void>;
  setAllModelsEnabled: (providerId: string, enabled: boolean) => Promise<void>;

  createMcpServer: (input: api.CreateMcpServerInput) => Promise<void>;
  updateMcpServer: (id: string, input: Partial<api.CreateMcpServerInput>) => Promise<void>;
  deleteMcpServer: (id: string) => Promise<void>;
  importMcpServers: (servers: api.CreateMcpServerInput[]) => Promise<number>;

  setSlot: (kind: SlotKind, slot: ModelSlot) => Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof api.AiApiError && error.isUnauthorized
    ? "unauthorized"
    : error instanceof Error
      ? error.message
      : "unknown";
}

export const useAiStore = create<AiState>((set, get) => ({
  providers: [],
  mcpServers: [],
  loading: false,
  loaded: false,
  error: null,
  slots: emptySlots(),

  load: async () => {
    if (providerLoadPromise) {
      await providerLoadPromise;
      return;
    }
    if (get().loaded) return;

    providerLoadPromise = get()
      .refresh()
      .finally(() => {
        providerLoadPromise = null;
      });
    await providerLoadPromise;
  },

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const [providers, mcp, slots] = await Promise.all([
        api.listProviders(),
        api.listMcpServers(),
        api.listModelSlots(),
      ]);
      set({
        providers: providers.providers,
        mcpServers: mcp.servers,
        slots: toSlots(slots.slots),
        loading: false,
        loaded: true,
      });
    } catch (error) {
      set({ loading: false, loaded: true, error: errorMessage(error) });
    }
  },

  refreshAdmin: async () => {
    set({ loading: true, error: null });
    try {
      const [providers, slots] = await Promise.all([
        api.listAdminProviders(),
        api.listAdminModelSlots(),
      ]);
      set({
        providers: providers.providers,
        slots: toSlots(slots.slots),
        loading: false,
      });
    } catch (error) {
      set({ loading: false, error: errorMessage(error) });
      throw error;
    }
  },

  createProvider: async (input) => {
    const provider = await api.createProvider(input);
    await get().refreshAdmin();
    return provider;
  },

  updateProvider: async (id, input) => {
    await api.updateProvider(id, input);
    await get().refreshAdmin();
  },

  deleteProvider: async (id) => {
    await api.deleteProvider(id);
    await get().refreshAdmin();
  },

  addModel: async (providerId, input) => {
    await api.addModel(providerId, input);
    await get().refreshAdmin();
  },

  updateModel: async (modelId, input) => {
    await api.updateModel(modelId, input);
    await get().refreshAdmin();
  },

  deleteModel: async (modelId) => {
    await api.deleteModel(modelId);
    await get().refreshAdmin();
  },

  setAllModelsEnabled: async (providerId, enabled) => {
    const provider = get().providers.find((candidate) => candidate.id === providerId);
    if (!provider) return;

    // 当目录包含数百个模型时，避免淹没连接池。
    for (const model of provider.models) {
      if (model.enabled !== enabled) {
        await api.updateModel(model.id, { enabled });
      }
    }
    await get().refreshAdmin();
  },

  createMcpServer: async (input) => {
    await api.createMcpServer(input);
    await get().refresh();
  },

  updateMcpServer: async (id, input) => {
    await api.updateMcpServer(id, input);
    await get().refresh();
  },

  deleteMcpServer: async (id) => {
    await api.deleteMcpServer(id);
    await get().refresh();
  },

  importMcpServers: async (servers) => {
    const { added } = await api.importMcpServers(servers);
    await get().refresh();
    return added;
  },

  setSlot: async (kind, slot) => {
    try {
      await api.updateModelSlot(kind, slot);
      await get().refreshAdmin();
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },
}));

export function usableProviders(providers: AiProvider[], category: ModelCategory): AiProvider[] {
  return providers.filter(
    (provider) =>
      provider.enabled &&
      (provider.hasApiKey || provider.builtinId === "ollama") &&
      enabledModels(provider, category).length > 0,
  );
}

/** 返回图片/视频节点可以实际使用的已启用模型，保持提供商和协议上下文。 */
export function usableModelSelections(providers: AiProvider[], category: ModelCategory) {
  return usableProviders(providers, category).flatMap((provider) =>
    enabledModels(provider, category).map((model) => ({
      provider,
      model,
      protocol: resolveProtocol(provider, model),
    })),
  );
}

export function resolveSlot(providers: AiProvider[], slot: ModelSlot) {
  if (!slot.providerId || !slot.modelId) return null;

  const provider = providers.find((candidate) => candidate.id === slot.providerId);
  if (!provider?.enabled) return null;

  const model = provider.models.find((candidate) => candidate.id === slot.modelId);
  if (!model?.enabled) return null;

  return { provider, model, protocol: resolveProtocol(provider, model) };
}
