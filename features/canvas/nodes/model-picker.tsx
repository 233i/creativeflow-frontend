"use client";

import { useMemo } from "react";
import { useT } from "@/components/providers/i18n-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModelIcon, ProviderIcon } from "@/features/ai/provider-icons";
import { usableProviders, useAiStore } from "@/features/ai/store";
import {
  type AiModel,
  type AiProvider,
  type ModelCategory,
  resolveProtocol,
} from "@/features/ai/types";
import { cn } from "@/lib/utils";

/**
 * 分为“提供商 → 模型”两步的选择器。
 *
 * 特意拆成两步而不是使用扁平模型列表：当同一模型可通过多个提供商访问时，只有模型 ID
 * 无法明确目标；所选提供商还决定凭据、接口地址和协议。
 */
export function ModelPicker({
  category,
  providerId,
  modelId,
  onChange,
}: {
  category: ModelCategory;
  providerId?: string;
  modelId?: string;
  onChange: (next: { providerId?: string; modelId?: string }) => void;
}) {
  const t = useT();
  const providers = useAiStore((state) => state.providers);

  const available = useMemo(() => usableProviders(providers, category), [providers, category]);

  const provider = available.find((candidate) => candidate.id === providerId);
  const models = useMemo(
    () =>
      provider
        ? provider.models.filter((model) => model.enabled && model.category === category)
        : [],
    [provider, category],
  );

  if (available.length === 0) {
    return (
      <p className="rounded-md bg-muted/50 px-2 py-1.5 text-[0.6875rem] text-muted-foreground">
        {t("node.noProvider")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        selectedKey={providerId ?? null}
        onSelectionChange={(key) => {
          // 必须清除原模型：旧模型属于另一个提供商，否则会悄然指向当前提供商不支持的模型。
          onChange({ providerId: String(key), modelId: undefined });
        }}
        className="w-full"
        aria-label={t("node.provider")}
      >
        <SelectTrigger size="sm" className="text-xs" aria-label={t("node.provider")}>
          <SelectValue>
            {provider ? (
              <span className="flex items-center gap-1.5">
                <ProviderIcon
                  builtinId={provider.builtinId}
                  icon={provider.icon}
                  name={provider.name}
                  size={13}
                />
                {provider.name}
              </span>
            ) : (
              t("node.selectProvider")
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {available.map((candidate) => (
            <SelectItem key={candidate.id} id={candidate.id}>
              <ProviderIcon
                builtinId={candidate.builtinId}
                icon={candidate.icon}
                name={candidate.name}
                size={14}
              />
              {candidate.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        selectedKey={modelId ?? null}
        onSelectionChange={(key) => onChange({ providerId, modelId: String(key) })}
        isDisabled={!provider || models.length === 0}
        className="w-full"
        aria-label={t("node.model")}
      >
        <SelectTrigger size="sm" className="text-xs" aria-label={t("node.model")}>
          <SelectValue>
            {(() => {
              const model = models.find((candidate) => candidate.id === modelId);
              if (!model) {
                return !provider
                  ? t("node.selectModel")
                  : models.length === 0
                    ? t(category === "video" ? "node.noVideoModel" : "node.noImageModel")
                    : t("node.selectModel");
              }

              return (
                <span className="flex items-center gap-1.5">
                  <ModelIcon
                    modelKey={model.modelKey}
                    icon={model.icon}
                    builtinId={provider?.builtinId}
                    size={13}
                  />
                  {model.name}
                </span>
              );
            })()}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.id} id={model.id}>
              <ModelIcon
                modelKey={model.modelKey}
                icon={model.icon}
                builtinId={provider?.builtinId}
                size={14}
              />
              {model.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** 将节点保存的 ID 解析为当前提供商和模型；任一 ID 已失效时返回 null。 */
export function useSelection(
  providerId: string | undefined,
  modelId: string | undefined,
): { provider: AiProvider; model: AiModel; protocol: ReturnType<typeof resolveProtocol> } | null {
  const providers = useAiStore((state) => state.providers);

  return useMemo(() => {
    if (!providerId || !modelId) return null;

    const provider = providers.find((candidate) => candidate.id === providerId);
    if (!provider?.enabled) return null;

    const model = provider.models.find((candidate) => candidate.id === modelId);
    if (!model?.enabled) return null;

    return { provider, model, protocol: resolveProtocol(provider, model) };
  }, [providers, providerId, modelId]);
}

/** 紧凑排列的一组互斥选项，用于画面比例、质量和分辨率。 */
export function ChipRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
  formatOption = String,
}: {
  label: string;
  options: readonly T[];
  value: T | undefined;
  onChange: (value: T) => void;
  formatOption?: (value: T) => string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={String(option)}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={cn(
              "min-h-6 rounded-md border px-1.5 py-0.5 text-[0.6875rem] transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              value === option
                ? "border-primary/40 bg-accent font-medium text-primary"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {formatOption(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
