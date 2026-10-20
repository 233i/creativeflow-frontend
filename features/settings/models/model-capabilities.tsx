"use client";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/features/settings/models/model-capability-toggle";
import type { ModelFormDialogController } from "@/features/settings/models/use-model-form";
import { FormField } from "@/features/settings/panels/panel-shell";
export function ModelCapabilities({ controller }: { controller: ModelFormDialogController }) {
  const {
    t,
    category,
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
  } = controller;
  return (
    <>
      {category === "chat" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("model.contextLength")}>
              <Input
                type="number"
                value={contextLength}
                onChange={(event) => setContextLength(event.target.value)}
                placeholder="128000"
                aria-label={t("model.contextLength")}
              />
            </FormField>

            <FormField label={t("model.maxOutputTokens")}>
              <Input
                type="number"
                value={maxOutputTokens}
                onChange={(event) => setMaxOutputTokens(event.target.value)}
                placeholder="16384"
                aria-label={t("model.maxOutputTokens")}
              />
            </FormField>
          </div>

          <FormField label={t("model.capabilities")}>
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <Toggle
                label={t("model.supportsVision")}
                value={supportsVision}
                onChange={setSupportsVision}
              />
              <Toggle
                label={t("model.supportsFunctionCall")}
                value={supportsFunctionCall}
                onChange={setSupportsFunctionCall}
              />
              <Toggle
                label={t("model.supportsThinking")}
                value={supportsThinking}
                onChange={setSupportsThinking}
              />
            </div>
          </FormField>
        </>
      )}
    </>
  );
}
