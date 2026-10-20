"use client";
import { useT } from "@/components/providers/i18n-provider";
import { presetRequiresApiKey } from "@/features/ai/presets";
import { ProviderIcon } from "@/features/ai/provider-icons";
import { type AiProvider } from "@/features/ai/types";
import { cn } from "@/lib/utils";

export function ProviderGroup({
  label,
  providers,
  selectedId,
  onSelect,
}: {
  label: string;
  providers: AiProvider[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useT();

  return (
    <div className="mb-2">
      <p className="px-2 py-1 text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>

      {providers.map((provider) => {
        const requiresKey =
          provider.type !== "openai-embeddings" && presetRequiresApiKey(provider.builtinId);
        // 使用三种状态，因为“已启用但不可用”值得明确展示：
        // 用户开启却未提供密钥的供应商，否则会看起来已经就绪。
        const status = !provider.enabled
          ? "off"
          : provider.hasApiKey || !requiresKey
            ? "ready"
            : "needsKey";

        return (
          <button
            key={provider.id}
            type="button"
            onClick={() => onSelect(provider.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
              provider.id === selectedId ? "bg-accent" : "hover:bg-accent/50",
            )}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background ring-1 ring-border">
              <ProviderIcon
                builtinId={provider.builtinId}
                icon={provider.icon}
                name={provider.name}
                size={16}
              />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{provider.name}</span>
              <span className="block text-[0.6875rem] text-muted-foreground">
                {t("provider.modelCount", {
                  enabled: provider.models.filter((m) => m.enabled).length,
                  total: provider.models.length,
                })}
              </span>
            </span>

            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                status === "ready" && "bg-emerald-500",
                status === "needsKey" && "bg-amber-500",
                status === "off" && "bg-muted-foreground/40",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
