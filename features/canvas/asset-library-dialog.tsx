"use client";

import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AssetLibraryDialogProps } from "./asset-library/types";
import { useLibraryController } from "./asset-library/controllers/use-library-controller";
import { LibraryToolbar } from "./asset-library/components/toolbar";
import { LibraryGroupSidebar } from "./asset-library/components/group-sidebar";
import { LibrarySelectionToolbar } from "./asset-library/components/selection-toolbar";
import { LibraryCollection } from "./asset-library/components/collection";
import { LibraryPagination } from "./asset-library/components/pagination";
import { LibraryFooter } from "./asset-library/components/footer";
import { LibraryConfirmations } from "./asset-library/components/confirmations";

/** Query, group mutations and insertion have separate lifetimes; presentation keeps the existing layout. */
export function AssetLibraryDialog(props: AssetLibraryDialogProps) {
  const t = useT();
  const controller = useLibraryController(props);
  const { picking, filters, query, commands, error } = controller;
  return (
    <div
      role="presentation"
      className="contents"
      onKeyDown={(event) => {
        if (picking) event.stopPropagation();
      }}
    >
      <Dialog
        isOpen
        aria-label={t("canvas.assetLibrary")}
        onOpenChange={commands.close}
        className="nodrag nopan nowheel h-[min(48rem,calc(100dvh-2rem))] w-[min(70rem,calc(100vw-2rem))] max-w-none gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="border-b px-6 py-5 pr-12">
            <DialogTitle>{t("canvas.assetLibrary")}</DialogTitle>
            <DialogDescription>
              {picking
                ? t("canvas.assetPickerHint")
                : `${t("canvas.assetLibraryHint")} ${t("canvas.assetGroupDragHint")}`}
            </DialogDescription>
          </DialogHeader>
          <LibraryToolbar controller={controller} />
          {error && (
            <div
              className="mx-4 mt-3 flex items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive"
              role="alert"
            >
              <span>{error}</span>
              <Button size="xs" variant="outline" isDisabled={query.loading} onPress={query.reload}>
                {t("common.retry")}
              </Button>
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-5 sm:flex-row sm:gap-6">
            {filters.section === "mine" && <LibraryGroupSidebar controller={controller} />}
            <section className="flex min-w-0 flex-1 flex-col gap-3">
              <LibrarySelectionToolbar controller={controller} />
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <LibraryCollection controller={controller} />
              </div>
              <LibraryPagination controller={controller} />
            </section>
          </div>
          <LibraryFooter controller={controller} />
        </div>
      </Dialog>
      <LibraryConfirmations controller={controller} />
    </div>
  );
}
