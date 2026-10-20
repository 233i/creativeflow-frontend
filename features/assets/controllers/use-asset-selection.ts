"use client";

import { useState } from "react";
import type { AssetItem } from "../types";

/** Selection belongs to a query scope, including history navigation and return trips. */
export function useAssetSelection(
  scope: string | object,
  items: AssetItem[],
  {
    limit = 50,
    single = false,
    selectedUrl,
  }: { limit?: number; single?: boolean; selectedUrl?: string } = {},
) {
  const [state, setState] = useState<{
    scope: typeof scope;
    selectedUrl?: string;
    ids: string[] | null;
  }>({
    scope,
    selectedUrl,
    ids: null,
  });
  const sameScope = state.scope === scope && state.selectedUrl === selectedUrl;
  if (!sameScope) setState({ scope, selectedUrl, ids: null });
  const preferred = selectedUrl ? items.find((item) => item.url === selectedUrl) : undefined;
  const ids = sameScope && state.ids !== null ? state.ids : preferred ? [preferred.id] : [];
  const selected = ids.flatMap((id) => items.find((item) => item.id === id) ?? []);
  const selectedIds = new Set(selected.map((item) => item.id));
  function choose(ids: string[]) {
    setState({ scope, selectedUrl, ids: ids.slice(0, single ? 1 : limit) });
  }
  function toggle(asset: AssetItem) {
    if (!items.some((item) => item.id === asset.id)) return;
    choose(
      selectedIds.has(asset.id)
        ? ids.filter((id) => id !== asset.id)
        : single
          ? [asset.id]
          : [...ids, asset.id],
    );
  }
  return {
    selected,
    selectedIds,
    toggle,
    clear: () => choose([]),
    selectPage: (checked: boolean) => choose(checked ? items.map((item) => item.id) : []),
  };
}
export type AssetSelection = ReturnType<typeof useAssetSelection>;
