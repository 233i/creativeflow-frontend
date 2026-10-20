"use client";
import { useT } from "@/components/providers/i18n-provider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModelIcon } from "@/features/ai/provider-icons";
import type { AgentPanelController } from "../controllers/use-agent-panel";
import type { ModelOption } from "../model-options";

function ModelCapabilityBadges({ model, t }: { model: ModelOption; t: ReturnType<typeof useT> }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1 text-[0.5625rem] text-muted-foreground">
      {model.supportsVision && <span title={t("agent.modelVision")}>{t("agent.modelVision")}</span>}
      {model.supportsThinking && (
        <span title={t("agent.modelThinking")}>{t("agent.modelThinking")}</span>
      )}
      {model.supportsFunctionCall && (
        <span title={t("agent.modelTools")}>{t("agent.modelTools")}</span>
      )}
    </span>
  );
}

export function AgentModelSelect({ controller }: { controller: AgentPanelController }) {
  const { t, models, effectiveModel, setSelectedModel, active, sending, selected, modelGroups } =
    controller;
  return (
    <Select
      selectedKey={models.length === 0 ? "none" : effectiveModel || null}
      onSelectionChange={(key) => {
        if (key !== null) setSelectedModel(String(key));
      }}
      isDisabled={active || sending || models.length === 0}
      className="min-w-0 flex-1"
      aria-label={t("agent.model")}
    >
      <SelectTrigger
        size="sm"
        className="h-7 min-w-0 border-0 bg-transparent px-1 text-xs shadow-none hover:bg-muted/60 focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent dark:hover:bg-muted/40"
      >
        <SelectValue>
          {selected ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <ModelIcon
                modelKey={selected.modelKey}
                icon={selected.modelIcon}
                builtinId={selected.providerBuiltinId}
                size={14}
              />
              <span className="truncate">{selected.modelName}</span>
            </span>
          ) : (
            t("agent.noModel")
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {models.length === 0 ? (
          <SelectItem id="none" isDisabled>
            {t("agent.noModel")}
          </SelectItem>
        ) : (
          modelGroups.map((group) => (
            <SelectGroup key={group.id}>
              <SelectLabel>{group.name}</SelectLabel>
              {group.models.map((model) => (
                <SelectItem key={model.value} id={model.value} textValue={model.modelName}>
                  <ModelIcon
                    modelKey={model.modelKey}
                    icon={model.modelIcon}
                    builtinId={model.providerBuiltinId}
                    size={15}
                  />
                  <span className="min-w-0 truncate">{model.modelName}</span>
                  <ModelCapabilityBadges model={model} t={t} />
                </SelectItem>
              ))}
            </SelectGroup>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
