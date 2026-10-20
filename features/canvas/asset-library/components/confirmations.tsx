"use client";

import { useT } from "@/components/providers/i18n-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { LibraryController } from "../controllers/use-library-controller";

export function LibraryConfirmations({ controller }: { controller: LibraryController }) {
  const t = useT();
  const { assets, groups } = controller;
  return (
    <>
      <ConfirmDialog
        isOpen={assets.deletingId !== null}
        onOpenChange={(open) => {
          if (!open) assets.setDeletingId(null);
        }}
        title="移入回收站？已有原件暂时保留，可从素材库回收站恢复。"
        onConfirm={() => (assets.deletingId ? assets.remove(assets.deletingId) : undefined)}
      />
      <ConfirmDialog
        isOpen={groups.pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) groups.setPendingDelete(null);
        }}
        title={t("canvas.assetGroupDelete")}
        description={
          groups.pendingDelete
            ? t("canvas.assetGroupDeleteConfirm", { name: groups.pendingDelete.name })
            : undefined
        }
        onConfirm={() => (groups.pendingDelete ? groups.remove(groups.pendingDelete) : undefined)}
      />
    </>
  );
}
