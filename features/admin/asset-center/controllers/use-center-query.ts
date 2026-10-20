"use client";

import { useMemo } from "react";
import { useAdminQuery } from "../../admin-query";
import { useAdminPreference } from "../../admin-preferences";
import { clearedAssetFilters, readAssetCenterQuery, type AssetFilterPatch } from "../query-state";

export function useCenterQuery() {
  const [params, update] = useAdminQuery();
  const [view, setView] = useAdminPreference("assetView", "grid");
  const state = useMemo(() => readAssetCenterQuery(params), [params]);
  return {
    ...state,
    params,
    view: view === "table" ? ("table" as const) : ("grid" as const),
    setView,
    detailId: params.get("asset"),
    filter: (values: AssetFilterPatch) => update({ ...values, assetPage: null }),
    setPage: (page: number) => update({ assetPage: String(page) }),
    showDetail: (id: string | null) => update({ asset: id }),
    showCleanable: () =>
      update({
        ...clearedAssetFilters(),
        assetTab: "recycle",
        usage: "purgeable",
        assetPage: null,
        asset: null,
      }),
  };
}
export type CenterQuery = ReturnType<typeof useCenterQuery>;
