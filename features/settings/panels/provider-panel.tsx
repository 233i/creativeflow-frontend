"use client";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAiStore } from "@/features/ai/store";
import { AddProviderDialog } from "@/features/settings/panels/add-provider-dialog";
import { MasterDetail, PanelEmpty } from "@/features/settings/panels/panel-shell";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ProviderDetail } from "../providers/provider-detail";
import { ProviderGroup } from "../providers/provider-group";
export function ProviderPanel() {
  const t = useT();
  const providers = useAiStore((state) => state.providers);
  const loading = useAiStore((state) => state.loading);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? providers.filter((p) => p.name.toLowerCase().includes(q)) : providers;
  }, [providers, query]);

  const { enabled, disabled } = useMemo(
    () => ({
      enabled: filtered.filter((p) => p.enabled),
      disabled: filtered.filter((p) => !p.enabled),
    }),
    [filtered],
  );

  const selected =
    providers.find((p) => p.id === selectedId) ?? (providers.length > 0 ? providers[0] : null);

  return (
    <>
      <MasterDetail
        list={
          <>
            <div className="flex items-center gap-1.5 border-b p-2">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("common.search")}
                  aria-label={t("common.search")}
                  className="h-7 pl-7 text-xs"
                />
              </div>
              <Button
                size="icon-sm"
                variant="outline"
                onPress={() => setAdding(true)}
                aria-label={t("provider.add")}
              >
                <Plus className="size-3.5" aria-hidden />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5">
              {loading && providers.length === 0 && (
                <p className="p-3 text-xs text-muted-foreground">{t("common.loading")}</p>
              )}

              {enabled.length > 0 && (
                <ProviderGroup
                  label={t("common.enabled")}
                  providers={enabled}
                  selectedId={selected?.id ?? null}
                  onSelect={setSelectedId}
                />
              )}
              {disabled.length > 0 && (
                <ProviderGroup
                  label={t("common.disabled")}
                  providers={disabled}
                  selectedId={selected?.id ?? null}
                  onSelect={setSelectedId}
                />
              )}
            </div>
          </>
        }
        detail={
          selected ? (
            <ProviderDetail key={selected.id} provider={selected} />
          ) : (
            <PanelEmpty
              title={t("provider.empty")}
              description={t("provider.emptyDescription")}
              action={
                <Button size="sm" onPress={() => setAdding(true)}>
                  <Plus className="size-3.5" aria-hidden />
                  {t("provider.add")}
                </Button>
              }
            />
          )
        }
      />

      <AddProviderDialog
        isOpen={adding}
        onOpenChange={setAdding}
        onCreated={(id) => setSelectedId(id)}
      />
    </>
  );
}
