"use client";

import { useT } from "@/components/providers/i18n-provider";
import { UNGROUPED_ASSETS } from "../types";
import type { LibraryController } from "../controllers/use-library-controller";

export function LibrarySelectionToolbar({ controller }: { controller: LibraryController }) {
  const t = useT();
  const { picking, filters, query, selection, groups, commands, activeLabel } = controller;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{activeLabel}</p>
        <p className="text-[0.6875rem] text-muted-foreground">
          {t("canvas.assetGroupCount", { count: query.total })}
        </p>
      </div>
      {!picking && filters.section === "mine" && selection.selected.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t("canvas.promptSelected", { count: selection.selected.length })}
          </span>
          <label className="relative">
            <span className="sr-only">{t("canvas.assetGroupMove")}</span>
            <select
              aria-label={t("canvas.assetGroupMove")}
              value=""
              disabled={!!commands.busy}
              onChange={(event) => {
                const target = event.currentTarget.value;
                if (target)
                  void groups.move(
                    selection.selected.map((asset) => asset.id),
                    target === UNGROUPED_ASSETS ? null : target,
                  );
              }}
              className="h-7 max-w-40 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
            >
              <option value="">{t("canvas.assetGroupMove")}</option>
              <option value={UNGROUPED_ASSETS}>{t("canvas.assetGroupMoveNone")}</option>
              {query.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
