"use client";
import { Input } from "@/components/ui/input";
import type { EmbeddingModelDialogController } from "@/features/settings/models/use-embedding-model";
import { FormField } from "@/features/settings/panels/panel-shell";
export function EmbeddingFields({ controller }: { controller: EmbeddingModelDialogController }) {
  const { t, draft, busy, change } = controller;
  if (!draft) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FormField label={t("embedding.path")}>
        <Input
          aria-label={t("embedding.path")}
          value={draft.endpointPath}
          disabled={busy}
          onChange={(e) => change("endpointPath", e.target.value)}
        />
      </FormField>
      <FormField label={t("embedding.revision")}>
        <Input
          aria-label={t("embedding.revision")}
          value={draft.modelRevision}
          disabled={busy}
          onChange={(e) => change("modelRevision", e.target.value)}
        />
      </FormField>
      {(
        [
          "expectedDimensions",
          "requestedDimensions",
          "maxBatchSize",
          "maxInputCharacters",
          "timeoutSeconds",
          "concurrency",
        ] as const
      ).map((key) => (
        <FormField key={key} label={t(`embedding.${key}`)}>
          <Input
            type="number"
            min={1}
            step={1}
            aria-label={t(`embedding.${key}`)}
            value={draft[key] ?? ""}
            disabled={busy}
            onChange={(e) =>
              change(
                key,
                e.target.value === "" &&
                  (key === "expectedDimensions" || key === "requestedDimensions")
                  ? null
                  : Number(e.target.value),
              )
            }
          />
        </FormField>
      ))}
    </div>
  );
}
