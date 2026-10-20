"use client";

import { useT } from "@/components/providers/i18n-provider";
import { useAssetSelection } from "@/features/assets/selection";
import { ALL_ASSETS, UNGROUPED_ASSETS, type AssetLibraryDialogProps } from "../types";
import { useLibraryAssets } from "./use-library-assets";
import { useLibraryCommands } from "./use-library-commands";
import { useLibraryFilters } from "./use-library-filters";
import { useLibraryGroups } from "./use-library-groups";
import { useLibraryInsertion } from "./use-library-insertion";
import { useLibraryQuery } from "./use-library-query";

export function useLibraryController(props: AssetLibraryDialogProps) {
  const t = useT();
  const picking = props.mode === "select";
  const source = props.mode === "select" ? props.source : undefined;
  const selectedUrl = props.mode === "select" ? props.selectedAssetUrl : undefined;
  const filters = useLibraryFilters(picking);
  const query = useLibraryQuery(filters, picking, source);
  const selection = useAssetSelection(query.selectionScope, query.visibleAssets, {
    limit: 24,
    single: picking,
    selectedUrl,
  });
  const commands = useLibraryCommands(query, props.onOpenChange, source);
  const groups = useLibraryGroups(query, filters, commands, picking);
  const assets = useLibraryAssets(query, commands, picking, filters.section);
  const insert = useLibraryInsertion(props, query, filters, selection, commands, source);
  const activeGroup = query.groups.find((group) => group.id === filters.activeGroupId);
  const activeLabel =
    filters.activeGroupId === ALL_ASSETS
      ? t("canvas.assetAll")
      : filters.activeGroupId === UNGROUPED_ASSETS
        ? t("canvas.assetUngrouped")
        : (activeGroup?.name ?? t("canvas.assetAll"));
  return {
    picking,
    source,
    filters,
    query,
    selection,
    commands,
    groups,
    assets,
    insert,
    activeLabel,
    error: commands.error || query.error,
  };
}
export type LibraryController = ReturnType<typeof useLibraryController>;
