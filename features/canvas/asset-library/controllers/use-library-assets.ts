"use client";

import { useState } from "react";
import { deleteAsset } from "../../api";
import { restoreLibraryAsset } from "@/features/assets/api";
import type { AssetItem } from "@/features/assets/types";
import type { LibraryQuery } from "./use-library-query";
import type { LibraryCommands } from "./use-library-commands";
import type { LibrarySection } from "../types";

export function useLibraryAssets(
  query: LibraryQuery,
  commands: LibraryCommands,
  picking: boolean,
  section: LibrarySection,
) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  async function remove(id: string) {
    const asset = query.assets.find((asset) => asset.id === id);
    if (picking || section !== "mine" || !asset?.canManage || query.loading) return;
    await commands.perform("remove", async (current) => {
      await deleteAsset(id);
      if (!current()) return;
      query.update((data) => ({
        ...data,
        assets: data.assets.filter((asset) => asset.id !== id),
        total: Math.max(0, data.total - 1),
      }));
      setDeletingId(null);
      query.reload();
    });
  }
  async function restore(asset: AssetItem) {
    if (
      picking ||
      section !== "recycle" ||
      !asset.canManage ||
      asset.state !== "recycled" ||
      query.loading
    )
      return;
    await commands.perform("restore", async (current) => {
      await restoreLibraryAsset(asset);
      if (current()) query.reload();
    });
  }
  return { deletingId, setDeletingId, remove, restore };
}
