"use client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmbeddingModelDialog } from "@/features/settings/panels/embedding-model-dialog";
import { RerankModelDialog } from "@/features/settings/panels/rerank-model-dialog";
import { ModelFormDialog } from "@/features/settings/panels/model-form-dialog";
import type { ProviderDetailController } from "./use-provider-detail";
export function ProviderDialogs({ controller }: { controller: ProviderDetailController }) {
  const {
    provider,
    t,
    deleteProvider,
    deleteModel,
    embeddingModelId,
    setEmbeddingModelId,
    rerankModelId,
    setRerankModelId,
    editingModel,
    setEditingModel,
    deletingProvider,
    setDeletingProvider,
    deletingModelId,
    setDeletingModelId,
  } = controller;
  return (
    <>
      {" "}
      {rerankModelId && provider.models.find((model) => model.id === rerankModelId) && (
        <RerankModelDialog
          key={rerankModelId}
          provider={provider}
          model={provider.models.find((model) => model.id === rerankModelId)!}
          onClose={() => setRerankModelId(null)}
        />
      )}
      {embeddingModelId && provider.models.find((model) => model.id === embeddingModelId) && (
        <EmbeddingModelDialog
          key={embeddingModelId}
          provider={provider}
          model={provider.models.find((model) => model.id === embeddingModelId)!}
          onClose={() => setEmbeddingModelId(null)}
        />
      )}
      {editingModel && (
        <ModelFormDialog
          isOpen
          onOpenChange={(open) => !open && setEditingModel(null)}
          provider={provider}
          model={
            editingModel === "new"
              ? null
              : (provider.models.find((m) => m.id === editingModel) ?? null)
          }
        />
      )}
      <ConfirmDialog
        isOpen={deletingProvider}
        onOpenChange={setDeletingProvider}
        title={t("provider.deleteConfirm", { name: provider.name })}
        onConfirm={() => deleteProvider(provider.id)}
      />
      <ConfirmDialog
        isOpen={deletingModelId !== null}
        onOpenChange={(open) => !open && setDeletingModelId(null)}
        title={t("model.deleteConfirm", {
          name: provider.models.find((m) => m.id === deletingModelId)?.name ?? "",
        })}
        onConfirm={() => {
          if (deletingModelId) return deleteModel(deletingModelId);
        }}
      />
    </>
  );
}
