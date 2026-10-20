"use client";
import { resolveSlot, useAiStore } from "@/features/ai/store";
import { resolveProtocol } from "@/features/ai/types";
import { useMemo, useState } from "react";
import type { ModelOption } from "../model-options";

const AGENT_PROTOCOLS = new Set(["anthropic", "openai-chat", "openai-responses"]);
export function useAgentModels() {
  const providers = useAiStore((state) => state.providers),
    slots = useAiStore((state) => state.slots);
  const [selectedModel, setSelectedModel] = useState("");
  const models = useMemo<ModelOption[]>(
    () =>
      providers.flatMap((provider) => {
        if (!provider.enabled || !provider.hasApiKey) return [];
        return provider.models
          .filter(
            (model) =>
              model.enabled &&
              model.category === "chat" &&
              AGENT_PROTOCOLS.has(resolveProtocol(provider, model)),
          )
          .map((model) => ({
            value: model.id,
            providerId: provider.id,
            modelKey: model.modelKey,
            providerName: provider.name,
            providerBuiltinId: provider.builtinId,
            modelName: model.name,
            modelIcon: model.icon,
            protocol: resolveProtocol(provider, model),
            supportsVision: model.supportsVision === true,
            supportsThinking: model.supportsThinking === true,
            supportsFunctionCall: model.supportsFunctionCall === true,
            contextLength: model.contextLength,
          }));
      }),
    [providers],
  );

  const preferred = resolveSlot(providers, slots.chat);
  const preferredOption = preferred
    ? models.find(
        (option) =>
          option.providerId === preferred.provider.id &&
          option.modelKey === preferred.model.modelKey,
      )
    : undefined;
  const effectiveModel = models.some((option) => option.value === selectedModel)
    ? selectedModel
    : (preferredOption?.value ?? models[0]?.value ?? "");
  const selected = models.find((option) => option.value === effectiveModel) ?? null;

  const modelGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; models: ModelOption[] }>();
    for (const model of models) {
      const current = groups.get(model.providerId);
      if (current) current.models.push(model);
      else
        groups.set(model.providerId, {
          id: model.providerId,
          name: model.providerName,
          models: [model],
        });
    }
    return [...groups.values()];
  }, [models]);

  return { models, modelGroups, selected, effectiveModel, setSelectedModel };
}
