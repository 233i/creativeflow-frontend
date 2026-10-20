"use client";
import { EmbeddingFields } from "@/features/settings/models/embedding-fields";
import { useEmbeddingModel } from "@/features/settings/models/use-embedding-model";
import { EmbeddingResult } from "../models/embedding-result";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type AiModel, type AiProvider } from "@/features/ai/types";
import { FormField } from "@/features/settings/panels/panel-shell";

/** 向量模型独立配置与测试；只测试已保存版本，编辑不会自动调用模型。 */
export function EmbeddingModelDialog({
  provider,
  model,
  onClose,
}: {
  provider: AiProvider;
  model: AiModel;
  onClose: () => void;
}) {
  const controller = useEmbeddingModel({ provider, model, onClose });
  const {
    t,
    saved,
    draft,
    inputs,
    setInputs,
    purpose,
    setPurpose,
    busy,
    error,
    setResult,
    dirty,
    protocolReady,
    canTest,
    change,
    save,
    test,
  } = controller;
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className="w-[min(40rem,calc(100vw-2rem))] max-w-none sm:max-w-none"
    >
      <DialogHeader>
        <DialogTitle>{t("embedding.title")}</DialogTitle>
        <DialogDescription>
          {provider.name} · {model.name}
        </DialogDescription>
      </DialogHeader>
      <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto">
        <p className="text-xs text-muted-foreground">{t("embedding.addressHint")}</p>
        <code className="break-all rounded bg-muted p-2 text-xs">
          {provider.baseUrl.replace(/\/+$/, "")}/{draft?.endpointPath ?? "embeddings"}
        </code>
        {!protocolReady && (
          <p role="alert" className="text-sm text-amber-600">
            {t("embedding.protocolHint")}
          </p>
        )}
        {draft && (
          <>
            <EmbeddingFields controller={controller} />
            <p className="text-xs text-muted-foreground">{t("embedding.dimensionsHint")}</p>
            {(["documentPrefix", "queryPrefix"] as const).map((key) => (
              <FormField key={key} label={t(`embedding.${key}`)}>
                <Textarea
                  aria-label={t(`embedding.${key}`)}
                  value={draft[key]}
                  disabled={busy}
                  onChange={(e) => change(key, e.target.value)}
                />
              </FormField>
            ))}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {dirty || !saved?.version ? t("embedding.unsaved") : t("embedding.saved")}
              </p>
              <Button
                size="sm"
                isDisabled={busy || (!dirty && !!saved?.version)}
                onPress={() => void save()}
              >
                {t("common.save")}
              </Button>
            </div>
            <section className="flex flex-col gap-3 border-t pt-4">
              <p className="text-xs text-muted-foreground">{t("embedding.testHint")}</p>
              <FormField label={t("embedding.purpose")}>
                <Select
                  aria-label={t("embedding.purpose")}
                  selectedKey={purpose}
                  isDisabled={busy}
                  onSelectionChange={(key) => {
                    setPurpose(key as "document" | "query");
                    setResult(null);
                  }}
                >
                  <SelectTrigger aria-label={t("embedding.purpose")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem id="document">{t("embedding.document")}</SelectItem>
                    <SelectItem id="query">{t("embedding.query")}</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t("embedding.inputs")}>
                <Textarea
                  aria-label={t("embedding.inputs")}
                  value={inputs}
                  disabled={busy}
                  onChange={(e) => {
                    setInputs(e.target.value);
                    setResult(null);
                  }}
                />
              </FormField>
              <Button isDisabled={!canTest} onPress={() => void test()}>
                {busy ? t("common.loading") : t("embedding.test")}
              </Button>
            </section>
          </>
        )}
        {!draft && !error && <p>{t("common.loading")}</p>}
        {error && (
          <p role="alert" className="break-words text-sm text-destructive">
            {error}
          </p>
        )}
        <EmbeddingResult controller={controller} />
      </div>
      <DialogFooter>
        <Button variant="outline" onPress={onClose}>
          {t("common.close")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
