"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { FormField } from "@/features/settings/panels/panel-shell";
import { Eye, EyeOff } from "lucide-react";
import type { ProviderDetailController } from "./use-provider-detail";
export function ProviderKeyField({ controller }: { controller: ProviderDetailController }) {
  const {
    provider,
    t,
    updateProvider,
    preset,
    apiKeyDraft,
    setApiKeyDraft,
    showKey,
    setShowKey,
    saving,
    saveApiKey,
  } = controller;
  return (
    <FormField
      label={t("provider.apiKey")}
      hint={provider.type === "openai-embeddings" ? t("embedding.optionalKey") : undefined}
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={showKey ? "text" : "password"}
            value={apiKeyDraft}
            onChange={(event) => setApiKeyDraft(event.target.value)}
            placeholder={
              provider.hasApiKey
                ? t("provider.apiKeyStored", { hint: provider.apiKeyHint ?? "" })
                : t("provider.apiKeyPlaceholder")
            }
            aria-label={t("provider.apiKey")}
            className="pr-8"
          />
          <TooltipTrigger>
            <button
              type="button"
              onClick={() => setShowKey((value) => !value)}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showKey ? "Hide" : "Show"}
            >
              {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
            <Tooltip>{showKey ? "Hide" : "Show"}</Tooltip>
          </TooltipTrigger>
        </div>

        <Button
          size="sm"
          variant="outline"
          isDisabled={!apiKeyDraft || saving}
          onPress={() => void saveApiKey()}
        >
          {t("common.save")}
        </Button>
        {provider.type === "openai-embeddings" && provider.hasApiKey && (
          <Button
            size="sm"
            variant="ghost"
            isDisabled={saving}
            onPress={() => void updateProvider(provider.id, { apiKey: "" })}
          >
            {t("embedding.clearKey")}
          </Button>
        )}
      </div>

      {preset?.apiKeyUrl && (
        <a
          href={preset.apiKeyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {t("provider.getApiKey")}
        </a>
      )}
    </FormField>
  );
}
