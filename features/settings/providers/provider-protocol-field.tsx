"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isProtocolReady } from "@/features/ai/protocol-support";
import { PROVIDER_TYPES, type ProviderType } from "@/features/ai/types";
import { FormField } from "@/features/settings/panels/panel-shell";
import type { ProviderDetailController } from "./use-provider-detail";
export function ProviderProtocolField({ controller }: { controller: ProviderDetailController }) {
  const { provider, t, updateProvider } = controller;
  return (
    <FormField label={t("provider.protocol")} hint={t("provider.protocolHint")}>
      <Select
        aria-label={t("provider.protocol")}
        selectedKey={provider.type}
        onSelectionChange={(key) =>
          void updateProvider(provider.id, { type: String(key) as ProviderType })
        }
        className="w-64 max-w-full"
      >
        <SelectTrigger aria-label={t("provider.protocol")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PROVIDER_TYPES.map((value) => (
            <SelectItem key={value} id={value}>
              {value}
              {!isProtocolReady(value) && (
                <span className="ml-1.5 text-[0.625rem] text-amber-600 dark:text-amber-500">
                  {t("provider.notSupported")}
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}
