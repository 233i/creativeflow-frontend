"use client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { ProviderIcon } from "@/features/ai/provider-icons";
import { Trash2 } from "lucide-react";
import type { ProviderDetailController } from "./use-provider-detail";
export function ProviderHeader({ controller }: { controller: ProviderDetailController }) {
  const { provider, t, updateProvider, preset, setDeletingProvider } = controller;
  return (
    <header className="flex shrink-0 items-center gap-3 border-b px-6 py-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border">
        <ProviderIcon
          builtinId={provider.builtinId}
          icon={provider.icon}
          name={provider.name}
          size={20}
        />
      </span>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold">{provider.name}</h2>
        {preset && <p className="truncate text-xs text-muted-foreground">{preset.description}</p>}
      </div>

      <Switch
        isSelected={provider.enabled}
        onChange={(value) => void updateProvider(provider.id, { enabled: value })}
        aria-label={provider.enabled ? t("common.disable") : t("common.enable")}
      />

      <TooltipTrigger>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={t("common.delete")}
          onPress={() => setDeletingProvider(true)}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
        <Tooltip>{t("common.delete")}</Tooltip>
      </TooltipTrigger>
    </header>
  );
}
