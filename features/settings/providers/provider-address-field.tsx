"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/features/settings/panels/panel-shell";
import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";
import type { ProviderDetailController } from "./use-provider-detail";
export function ProviderAddressField({ controller }: { controller: ProviderDetailController }) {
  const { t, baseUrl, setBaseUrl, check, checking, saveBaseUrl, runCheck } = controller;
  return (
    <FormField label={t("provider.baseUrl")}>
      <div className="flex gap-2">
        <Input
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          onBlur={() => void saveBaseUrl()}
          aria-label={t("provider.baseUrl")}
          className="flex-1 font-mono text-xs"
        />
        <Button size="sm" variant="outline" isDisabled={checking} onPress={() => void runCheck()}>
          {checking ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Check className="size-3.5" aria-hidden />
          )}
          {checking ? t("provider.checking") : t("provider.check")}
        </Button>
      </div>

      {check && (
        <p
          className={cn(
            "text-xs",
            check.ok ? "text-emerald-600 dark:text-emerald-500" : "text-destructive",
          )}
        >
          {check.ok
            ? `${t("provider.checkSuccess")} · ${t("provider.fetchedModels", { count: check.modelCount ?? 0 })}`
            : `${t("provider.checkFailed")}${check.statusCode ? ` (${check.statusCode})` : ""}: ${check.error ?? ""}`}
        </p>
      )}
    </FormField>
  );
}
