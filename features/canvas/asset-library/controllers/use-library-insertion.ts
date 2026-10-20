"use client";

import { getLibraryAsset, reusePublicAsset } from "@/features/assets/api";
import { assetError } from "@/features/assets/commands";
import type { AssetSelection } from "@/features/assets/selection";
import type { AssetItem } from "@/features/assets/types";
import { useCanvasStore } from "../../store";
import { NODE_DEFAULT_SIZE } from "../../types";
import type { AssetLibraryDialogProps, LibrarySource } from "../types";
import type { LibraryCommands } from "./use-library-commands";
import type { LibraryFilters } from "./use-library-filters";
import type { LibraryQuery } from "./use-library-query";

export function useLibraryInsertion(
  props: AssetLibraryDialogProps,
  query: LibraryQuery,
  filters: LibraryFilters,
  selection: AssetSelection,
  commands: LibraryCommands,
  source?: LibrarySource,
) {
  async function copyPublicAssets(assets: AssetItem[], current: () => boolean) {
    const copies: AssetItem[] = [];
    for (const asset of assets) {
      if (!current()) return [];
      copies.push(
        await (source ? source.reusePublicAsset : reusePublicAsset)(asset.id, asset.revision),
      );
    }
    return copies;
  }
  async function insert() {
    if (query.loading || filters.section === "recycle") return;
    const chosen = query.visibleAssets.filter((asset) => selection.selectedIds.has(asset.id));
    if (!chosen.length) return;
    await commands.perform(
      "reuse",
      async (current) => {
        // Public IDs belong to another space; the consumer receives owned copies only.
        const assets =
          filters.section === "public" ? await copyPublicAssets(chosen, current) : chosen;
        if (!current()) return;
        if (props.mode === "select") props.onSelect({ ...assets[0], prompt: null });
        else {
          const details = await Promise.all(assets.map((asset) => getLibraryAsset(asset.id)));
          if (!current()) return;
          if (details.some((detail) => detail.asset.state !== "active"))
            throw new Error("素材状态已变化，请刷新后重新选择。");
          const origin = props.at();
          details.forEach(({ asset, prompt }, index) =>
            useCanvasStore
              .getState()
              .addNode(
                asset.kind,
                { x: origin.x + index * (NODE_DEFAULT_SIZE.image.width + 24), y: origin.y },
                { assetUrl: asset.url, mediaType: asset.mediaType, prompt: prompt ?? undefined },
              ),
          );
        }
        commands.close(false);
      },
      (reason) =>
        `${assetError(reason, "复用未完成")}${filters.section === "public" ? " 已成功复用的项目可在我的素材中找到。" : ""}`,
    );
  }
  return insert;
}
