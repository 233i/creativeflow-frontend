"use client";
import type { EmbeddingModelDialogController } from "@/features/settings/models/use-embedding-model";
export function EmbeddingResult({ controller }: { controller: EmbeddingModelDialogController }) {
  const { t, result } = controller;
  return (
    <>
      {result && (
        <div
          role="status"
          className={`rounded-lg border p-3 text-sm ${result.ok ? "border-emerald-500/40" : "border-destructive text-destructive"}`}
        >
          <p>
            {result.ok
              ? t("embedding.success", {
                  count: result.count,
                  dimensions: result.dimensions ?? 0,
                  elapsed: result.elapsedMilliseconds,
                })
              : `${result.code}: ${result.error}`}
          </p>
          {result.totalTokens !== null && (
            <p className="mt-1 text-xs">{t("embedding.tokens", { count: result.totalTokens })}</p>
          )}
          {result.configurationFingerprint && (
            <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
              {result.configurationFingerprint}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{t("embedding.fingerprintHint")}</p>
        </div>
      )}
    </>
  );
}
