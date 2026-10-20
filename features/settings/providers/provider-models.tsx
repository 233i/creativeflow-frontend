"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { PanelSection } from "@/features/settings/panels/panel-shell";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { ProviderModelRow } from "./provider-model-row";
import type { ProviderDetailController } from "./use-provider-detail";
export function ProviderModels({ controller }: { controller: ProviderDetailController }) {
  const {
    provider,
    t,
    setAllModelsEnabled,
    fetching,
    fetchMessage,
    modelQuery,
    setModelQuery,
    setEditingModel,
    visibleModels,
    fetchModels,
  } = controller;
  return (
    <PanelSection
      title={t("provider.models")}
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onPress={() => void setAllModelsEnabled(provider.id, true)}
          >
            {t("provider.enableAll")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => void setAllModelsEnabled(provider.id, false)}
          >
            {t("provider.disableAll")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            isDisabled={fetching}
            onPress={() => void fetchModels()}
          >
            {fetching ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden />
            )}
            {fetching ? t("provider.fetching") : t("provider.fetchModels")}
          </Button>
          <TooltipTrigger>
            <Button
              size="icon-sm"
              variant="outline"
              onPress={() => setEditingModel("new")}
              aria-label={t("provider.addModel")}
            >
              <Plus className="size-3.5" aria-hidden />
            </Button>
            <Tooltip>{t("provider.addModel")}</Tooltip>
          </TooltipTrigger>
        </div>
      }
    >
      {fetchMessage && <p className="text-xs text-muted-foreground">{fetchMessage}</p>}

      {provider.models.length > 3 && (
        <Input
          value={modelQuery}
          onChange={(event) => setModelQuery(event.target.value)}
          placeholder={t("common.search")}
          aria-label={t("common.search")}
          className="h-7 text-xs"
        />
      )}

      {provider.models.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          {t("provider.noModels")}
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {visibleModels.map((model) => (
            <ProviderModelRow key={model.id} controller={controller} model={model} />
          ))}
        </div>
      )}
    </PanelSection>
  );
}
