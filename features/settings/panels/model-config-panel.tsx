"use client";

import { useState } from "react";
import { Switch } from "tdesign-react";
import { useT } from "@/components/providers/i18n-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModelIcon, ProviderIcon } from "@/features/ai/provider-icons";
import { type ModelSlot, type SlotKind, useAiStore } from "@/features/ai/store";
import type { AiModel, AiProvider, ModelCategory } from "@/features/ai/types";
import { PanelBody, PanelHeader, PanelSection } from "@/features/settings/panels/panel-shell";

const UNSET = "__unset__";

const GROUPS = [
  {
    category: "image",
    titleKey: "modelConfig.imageModels",
    roles: [{ kind: "image", labelKey: "modelConfig.imageDefault" }],
  },
  {
    category: "video",
    titleKey: "modelConfig.videoModels",
    roles: [{ kind: "video", labelKey: "modelConfig.videoDefault" }],
  },
  {
    category: "chat",
    titleKey: "modelConfig.chatModels",
    roles: [
      { kind: "chat", labelKey: "modelConfig.chatDefault" },
      { kind: "fast", labelKey: "modelConfig.fastDefault" },
    ],
  },
] as const satisfies ReadonlyArray<{
  category: ModelCategory;
  titleKey: "modelConfig.imageModels" | "modelConfig.videoModels" | "modelConfig.chatModels";
  roles: ReadonlyArray<{
    kind: SlotKind;
    labelKey:
      | "modelConfig.imageDefault"
      | "modelConfig.videoDefault"
      | "modelConfig.chatDefault"
      | "modelConfig.fastDefault";
  }>;
}>;

type ModelEntry = { provider: AiProvider; model: AiModel };

function configuredModels(providers: AiProvider[], category: ModelCategory): ModelEntry[] {
  return providers
    .filter(
      (provider) => provider.enabled && (provider.hasApiKey || provider.builtinId === "ollama"),
    )
    .flatMap((provider) =>
      provider.models
        .filter((model) => model.category === category)
        .map((model) => ({ provider, model })),
    )
    .sort(
      (a, b) =>
        a.model.name.localeCompare(b.model.name) || a.provider.name.localeCompare(b.provider.name),
    );
}

/**
 * 管理后台的模型启用与默认角色配置。
 *
 * 启用列表使用模型本身的 enabled 状态，允许同一用途同时启用多个模型；默认角色仍然
 * 使用旧的 model slot 表保存，供聊天、媒体节点和旧工作流作为默认入口使用。
 */
export function ModelConfigPanel() {
  const t = useT();
  const providers = useAiStore((state) => state.providers);
  const slots = useAiStore((state) => state.slots);
  const updateModel = useAiStore((state) => state.updateModel);
  const setSlot = useAiStore((state) => state.setSlot);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  async function setEnabled(entry: ModelEntry, enabled: boolean) {
    setError(null);
    setPendingIds((current) => new Set(current).add(entry.model.id));
    try {
      await updateModel(entry.model.id, { enabled });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("model.updateFailed"));
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(entry.model.id);
        return next;
      });
    }
  }

  return (
    <>
      <PanelHeader title={t("modelConfig.title")} description={t("modelConfig.description")} />

      <PanelBody>
        {error && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {error}
          </p>
        )}

        {GROUPS.map(({ category, titleKey, roles }) => {
          const entries = configuredModels(providers, category);
          const enabledEntries = entries.filter(({ model }) => model.enabled);

          return (
            <PanelSection
              key={category}
              title={t(titleKey)}
              description={t("modelConfig.enabledHint", { count: enabledEntries.length })}
            >
              {entries.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("modelConfig.noAvailable")}</p>
              ) : (
                <>
                  <div className="divide-y rounded-lg border">
                    {entries.map((entry) => (
                      <div
                        key={entry.model.id}
                        className="flex flex-wrap items-center gap-3 px-3 py-3"
                      >
                        <ModelIcon
                          modelKey={entry.model.modelKey}
                          icon={entry.model.icon}
                          builtinId={entry.provider.builtinId}
                          size={18}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{entry.model.name}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <ProviderIcon
                              builtinId={entry.provider.builtinId}
                              icon={entry.provider.icon}
                              name={entry.provider.name}
                              size={12}
                            />
                            <span className="truncate">{entry.provider.name}</span>
                            <span aria-hidden>·</span>
                            <span className="truncate font-mono">{entry.model.modelKey}</span>
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {t(entry.model.enabled ? "common.enabled" : "common.disabled")}
                        </span>
                        <Switch
                          value={entry.model.enabled}
                          loading={pendingIds.has(entry.model.id)}
                          onChange={(enabled) => void setEnabled(entry, enabled)}
                          aria-label={`${entry.model.name} · ${entry.provider.name}`}
                          aria-checked={entry.model.enabled}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {roles.map(({ kind, labelKey }) => {
                      const slot = slots[kind];
                      const selectedKey =
                        slot.providerId && slot.modelId
                          ? `${slot.providerId}::${slot.modelId}`
                          : UNSET;

                      return (
                        <div key={kind} className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-muted-foreground">
                            {t(labelKey)}
                          </span>
                          <Select
                            aria-label={t(labelKey)}
                            selectedKey={selectedKey}
                            isDisabled={enabledEntries.length === 0}
                            onSelectionChange={(key) => {
                              const value = String(key);
                              if (value === UNSET) {
                                void setSlot(kind, { providerId: null, modelId: null });
                                return;
                              }

                              const [providerId, modelId] = value.split("::");
                              void setSlot(kind, { providerId, modelId } satisfies ModelSlot);
                            }}
                            className="w-full"
                          >
                            <SelectTrigger aria-label={t(labelKey)} size="sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem id={UNSET}>{t("modelConfig.notSet")}</SelectItem>
                              <SelectSeparator />
                              {enabledEntries.map(({ provider, model }) => (
                                <SelectItem key={model.id} id={`${provider.id}::${model.id}`}>
                                  <ModelIcon
                                    modelKey={model.modelKey}
                                    icon={model.icon}
                                    builtinId={provider.builtinId}
                                    size={14}
                                  />
                                  {provider.name} · {model.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </PanelSection>
          );
        })}
      </PanelBody>
    </>
  );
}
