"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Switch } from "tdesign-react";
import { useT } from "@/components/providers/i18n-provider";
import { Input } from "@/components/ui/input";
import { ModelIcon, ProviderIcon } from "@/features/ai/provider-icons";
import { useAiStore } from "@/features/ai/store";
import type { AiModel, AiProvider } from "@/features/ai/types";
import { PanelBody, PanelEmpty, PanelHeader } from "@/features/settings/panels/panel-shell";

interface CatalogEntry {
  key: string;
  model: AiModel;
  provider: AiProvider;
}

/**
 * 管理员的全局模型目录。
 *
 * 即使两个供应商公开相同的上游模型键，每个供应商仍各保留一条模型记录。
 * 启用状态属于具体供应商和模型组合；禁用聚合商副本不能同时静默禁用官方供应商副本。
 */
export function ModelPanel() {
  const t = useT();
  const providers = useAiStore((state) => state.providers);
  const updateModel = useAiStore((state) => state.updateModel);
  const [query, setQuery] = useState("");
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const catalog = useMemo(() => {
    const entries = providers.flatMap((provider) =>
      provider.models.map((model): CatalogEntry => ({ key: model.id, model, provider })),
    );

    return entries.sort(
      (a, b) =>
        a.model.modelKey.localeCompare(b.model.modelKey) ||
        a.provider.name.localeCompare(b.provider.name),
    );
  }, [providers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (entry) =>
        entry.model.modelKey.toLowerCase().includes(q) ||
        entry.model.name.toLowerCase().includes(q) ||
        entry.provider.name.toLowerCase().includes(q),
    );
  }, [catalog, query]);

  async function setEnabled(entry: CatalogEntry, enabled: boolean) {
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
      <PanelHeader title={t("model.title")} />

      {catalog.length === 0 ? (
        <PanelEmpty title={t("model.empty")} description={t("provider.emptyDescription")} />
      ) : (
        <PanelBody className="gap-3">
          {error && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          )}

          <div className="relative w-full max-w-lg">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("common.search")}
              aria-label={t("common.search")}
              className="pl-8"
            />
          </div>

          <div className="divide-y border-y">
            {filtered.map((entry) => (
              <div key={entry.key} className="flex flex-wrap items-center gap-3 px-2 py-5">
                <ModelIcon
                  modelKey={entry.model.modelKey}
                  icon={entry.model.icon}
                  builtinId={entry.provider.builtinId}
                  size={18}
                />

                <div className="min-w-40 flex-1">
                  <p className="text-sm font-medium">{entry.model.name}</p>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                    {entry.model.modelKey}
                  </p>
                </div>

                <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {t(
                    `model.category${entry.model.category.charAt(0).toUpperCase()}${entry.model.category.slice(1)}` as Parameters<
                      typeof t
                    >[0],
                  )}
                </span>

                {entry.model.contextLength && (
                  <span className="shrink-0 text-[0.625rem] text-muted-foreground">
                    {Math.round(entry.model.contextLength / 1000)}K
                  </span>
                )}

                <div
                  className="flex max-w-36 shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
                  title={entry.provider.name}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded bg-background ring-1 ring-border">
                    <ProviderIcon
                      builtinId={entry.provider.builtinId}
                      icon={entry.provider.icon}
                      name={entry.provider.name}
                      size={11}
                    />
                  </span>
                  <span className="truncate">{entry.provider.name}</span>
                </div>

                <span
                  className={
                    entry.model.enabled
                      ? "w-11 shrink-0 text-[0.6875rem] text-emerald-600 dark:text-emerald-500"
                      : "w-11 shrink-0 text-[0.6875rem] text-muted-foreground"
                  }
                >
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
        </PanelBody>
      )}
    </>
  );
}
