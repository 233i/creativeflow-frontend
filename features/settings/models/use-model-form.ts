"use client";
import { useT } from "@/components/providers/i18n-provider";
import { useAiStore } from "@/features/ai/store";
import {
  type AiModel,
  type AiProvider,
  type ModelCategory,
  PROTOCOLS_BY_CATEGORY,
  type ProviderType,
  resolveProtocol,
} from "@/features/ai/types";
import { INHERIT } from "@/features/settings/models/model-form-options";
import { useState } from "react";
import { modelCapabilitiesDraft } from "./model-capabilities-draft";

export function useModelForm({
  isOpen,
  onOpenChange,
  provider,
  model,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  provider: AiProvider;
  /** 空值表示创建新模型。 */
  model: AiModel | null;
}) {
  const t = useT();
  const addModel = useAiStore((state) => state.addModel);
  const updateModel = useAiStore((state) => state.updateModel);

  const [modelKey, setModelKey] = useState(model?.modelKey ?? "");
  const [name, setName] = useState(model?.name ?? "");
  const [category, setCategory] = useState<ModelCategory>(model?.category ?? "chat");
  const [type, setType] = useState<ProviderType | typeof INHERIT>(model?.type ?? INHERIT);
  const [contextLength, setContextLength] = useState(model?.contextLength?.toString() ?? "");
  const [maxOutputTokens, setMaxOutputTokens] = useState(model?.maxOutputTokens?.toString() ?? "");
  const capabilities = modelCapabilitiesDraft(model);
  const [supportsVision, setSupportsVision] = useState(capabilities.supportsVision);
  const [supportsFunctionCall, setSupportsFunctionCall] = useState(
    capabilities.supportsFunctionCall,
  );
  const [supportsThinking, setSupportsThinking] = useState(capabilities.supportsThinking);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNew = model === null;

  // 未覆盖时模型会解析到的协议，使“继承”具有明确含义。
  const inheritedProtocol = resolveProtocol(provider, { type: null, category });
  const allowedProtocols = PROTOCOLS_BY_CATEGORY[category];

  async function save() {
    if (!modelKey.trim() || busy) return;

    setBusy(true);
    setError(null);

    const parsedContext = contextLength.trim() ? Number(contextLength) : null;
    const parsedOutput = maxOutputTokens.trim() ? Number(maxOutputTokens) : null;

    try {
      if (isNew) {
        await addModel(provider.id, {
          modelKey: modelKey.trim(),
          name: name.trim() || modelKey.trim(),
          category,
          type: type === INHERIT ? null : type,
          contextLength: parsedContext,
          maxOutputTokens: parsedOutput,
          supportsVision,
          supportsFunctionCall,
          supportsThinking,
          enabled: true,
        });
      } else {
        await updateModel(model.id, {
          name: name.trim() || modelKey.trim(),
          category,
          // "" 是服务器清除覆盖的信号，与省略字段不同。
          type: type === INHERIT ? "" : type,
          contextLength: parsedContext,
          maxOutputTokens: parsedOutput,
          supportsVision,
          supportsFunctionCall,
          supportsThinking,
        });
      }

      onOpenChange(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("errors.unknown"));
    } finally {
      setBusy(false);
    }
  }

  return {
    isOpen,
    onOpenChange,
    provider,
    model,
    t,
    addModel,
    updateModel,
    modelKey,
    setModelKey,
    name,
    setName,
    category,
    setCategory,
    type,
    setType,
    contextLength,
    setContextLength,
    maxOutputTokens,
    setMaxOutputTokens,
    supportsVision,
    setSupportsVision,
    supportsFunctionCall,
    setSupportsFunctionCall,
    supportsThinking,
    setSupportsThinking,
    busy,
    setBusy,
    error,
    setError,
    isNew,
    inheritedProtocol,
    allowedProtocols,
    save,
  };
}
export type ModelFormDialogController = ReturnType<typeof useModelForm>;
