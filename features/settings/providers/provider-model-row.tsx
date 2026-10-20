"use client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { isProtocolReady } from "@/features/ai/protocol-support";
import { ModelIcon } from "@/features/ai/provider-icons";
import type { AiModel } from "@/features/ai/types";
import { resolveProtocol } from "@/features/ai/types";
import { Search, Trash2 } from "lucide-react";
import type { ProviderDetailController } from "./use-provider-detail";
function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ProviderModelRow({
  controller,
  model,
}: {
  controller: ProviderDetailController;
  model: AiModel;
}) {
  const {
    provider,
    t,
    updateModel,
    setEmbeddingModelId,
    setRerankModelId,
    setEditingModel,
    setDeletingModelId,
  } = controller;
  return (
    <div key={model.id} className="flex flex-wrap items-center gap-2.5 px-4 py-4">
      <ModelIcon
        modelKey={model.modelKey}
        icon={model.icon}
        builtinId={provider.builtinId}
        size={15}
      />

      <div className="min-w-32 flex-1">
        <p className="truncate text-sm font-medium">{model.name}</p>
        <p className="truncate font-mono text-[0.6875rem] text-muted-foreground">
          {model.modelKey}
        </p>
      </div>

      {!isProtocolReady(resolveProtocol(provider, model)) && (
        <span
          title={t("provider.notSupportedHint")}
          className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[0.625rem] text-amber-700 dark:text-amber-500"
        >
          {t("provider.notSupported")}
        </span>
      )}

      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
        {t(`model.category${cap(model.category)}` as Parameters<typeof t>[0])}
      </span>

      {/* 仅在设置后显示；覆盖属于例外情况，每行都显示继承协议只会增加噪声。 */}
      {model.type && (
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground">
          {model.type}
        </span>
      )}

      {model.category === "embedding" && (
        <Button size="sm" variant="outline" onPress={() => setEmbeddingModelId(model.id)}>
          {t("embedding.title")}
        </Button>
      )}
      {model.category === "rerank" && (
        <Button size="sm" variant="outline" onPress={() => setRerankModelId(model.id)}>
          重排序配置
        </Button>
      )}

      <Switch
        isSelected={model.enabled && isProtocolReady(resolveProtocol(provider, model))}
        isDisabled={!isProtocolReady(resolveProtocol(provider, model))}
        onChange={(value) => void updateModel(model.id, { enabled: value })}
        aria-label={model.name}
      />

      <TooltipTrigger>
        <Button
          size="icon-sm"
          variant="ghost"
          onPress={() => setEditingModel(model.id)}
          aria-label={t("common.edit")}
        >
          <Search className="size-3" aria-hidden />
        </Button>
        <Tooltip>{t("common.edit")}</Tooltip>
      </TooltipTrigger>

      <TooltipTrigger>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={t("common.delete")}
          onPress={() => setDeletingModelId(model.id)}
        >
          <Trash2 className="size-3" aria-hidden />
        </Button>
        <Tooltip>{t("common.delete")}</Tooltip>
      </TooltipTrigger>
    </div>
  );
}
