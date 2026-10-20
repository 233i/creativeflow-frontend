"use client";
import { type AiProvider } from "@/features/ai/types";
import { TriangleAlert } from "lucide-react";
import { ProviderAddressField } from "./provider-address-field";
import { ProviderDialogs } from "./provider-dialogs";
import { ProviderHeader } from "./provider-header";
import { ProviderKeyField } from "./provider-key-field";
import { ProviderModels } from "./provider-models";
import { ProviderProtocolField } from "./provider-protocol-field";
import { useProviderDetail } from "./use-provider-detail";
export function ProviderDetail({ provider }: { provider: AiProvider }) {
  const controller = useProviderDetail(provider);
  const { t, requiresKey, isBuiltin, error } = controller;
  return (
    <>
      <ProviderHeader controller={controller} />

      <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-6">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {(requiresKey || provider.type === "openai-embeddings") && (
          <ProviderKeyField controller={controller} />
        )}

        <ProviderAddressField controller={controller} />

        {/* 内置供应商保持预设声明的协议：预设模型列表和基础 URL 都以该协议为依据，修改会同时破坏两者。 */}
        {!isBuiltin && <ProviderProtocolField controller={controller} />}

        <ProviderModels controller={controller} />

        {provider.enabled && requiresKey && !provider.hasApiKey && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
            <TriangleAlert className="size-3.5" aria-hidden />
            {t("provider.needsApiKey")}
          </p>
        )}
      </div>

      <ProviderDialogs controller={controller} />
    </>
  );
}
