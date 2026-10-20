"use client";

import { useEffect, useMemo, useState } from "react";
import { listLibraryAssets } from "@/features/assets/api";
import { assetError } from "@/features/assets/commands";
import { listAssetGroups } from "../../api";
import { useRequestScope } from "@/lib/hooks/use-request-scope";
import type { LibraryFilters } from "./use-library-filters";
import type { LibraryData, LibrarySource } from "../types";

export function useLibraryQuery(filters: LibraryFilters, picking: boolean, source?: LibrarySource) {
  const [revision, setRevision] = useState(0);
  const query = filters.query;
  const identity = useMemo(() => ({ query, source, revision }), [query, source, revision]);
  const capture = useRequestScope(identity);
  const [result, setResult] = useState<{
    identity: typeof identity;
    data: LibraryData;
    error: string | null;
    unavailable: boolean;
  } | null>(null);
  useEffect(() => {
    let disposed = false;
    const abort = new AbortController();
    void Promise.allSettled([
      source ? source.listAssetPage(query) : listLibraryAssets(query, abort.signal),
      source ? source.listAssetGroups() : listAssetGroups(),
    ]).then(([assets, groups]) => {
      if (disposed) return;
      const data: LibraryData = {
        assets:
          assets.status === "fulfilled"
            ? assets.value.items.filter((asset) => !picking || asset.kind === "image")
            : [],
        total: assets.status === "fulfilled" ? assets.value.total : 0,
        groups: groups.status === "fulfilled" ? groups.value.groups : [],
      };
      const failure =
        assets.status === "rejected" ? assets : groups.status === "rejected" ? groups : null;
      setResult({
        identity,
        data,
        error: failure ? assetError(failure.reason, "素材读取失败。") : null,
        unavailable: assets.status === "rejected",
      });
    });
    return () => {
      disposed = true;
      abort.abort();
    };
  }, [identity, picking, query, source]);
  const current = result?.identity === identity;
  const unavailable = current && result.unavailable;
  const selectionScope = useMemo(
    () => ({ query, source, unavailable }),
    [query, source, unavailable],
  );
  const assets = current ? result.data.assets : [];
  const groups = result && result.identity.source === source ? result.data.groups : [];
  const visibleAssets = assets.filter(
    (asset) =>
      (!query.groupId || asset.groupId === query.groupId) && (!query.ungrouped || !asset.groupId),
  );
  function update(change: (data: LibraryData) => LibraryData) {
    setResult((previous) =>
      previous?.identity === identity ? { ...previous, data: change(previous.data) } : previous,
    );
  }
  return {
    scope: identity,
    selectionScope,
    assets,
    visibleAssets,
    groups,
    total: current ? result.data.total : 0,
    loading: !current,
    error: current ? result.error : null,
    revision,
    capture,
    update,
    reload: () => setRevision((value) => value + 1),
  };
}
export type LibraryQuery = ReturnType<typeof useLibraryQuery>;
