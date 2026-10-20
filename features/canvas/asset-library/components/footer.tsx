"use client";

import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import type { LibraryController } from "../controllers/use-library-controller";

export function LibraryFooter({ controller }: { controller: LibraryController }) {
  const t = useT();
  const { selection, commands, query, filters, picking, insert } = controller;
  return (
    <DialogFooter className="mx-0 mb-0 rounded-none rounded-b-xl">
      <span className="mr-auto text-xs text-muted-foreground">
        {selection.selected.length > 0
          ? t("canvas.promptSelected", { count: selection.selected.length })
          : ""}
      </span>
      <Button variant="outline" size="sm" onPress={() => commands.close(false)}>
        {t("common.cancel")}
      </Button>
      <Button
        size="sm"
        isDisabled={
          query.loading ||
          !!commands.busy ||
          selection.selected.length === 0 ||
          filters.section === "recycle"
        }
        onPress={() => void insert()}
      >
        {t(picking ? "canvas.assetUseImage" : "common.add")}
      </Button>
    </DialogFooter>
  );
}
