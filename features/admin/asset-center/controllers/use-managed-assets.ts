"use client";

import { useEffect, useMemo, useState } from "react";
import { assetFacets, listManagedAssets } from "@/features/assets/api";
import { assetError } from "@/features/assets/commands";
import type { AssetFacets, AssetPage } from "@/features/assets/types";
import type { CenterQuery } from "./use-center-query";
import { useWorkspaceActive } from "@/components/providers/workspace-context";

export function useManagedAssets({ key, query, tab }: CenterQuery) {
  const active = useWorkspaceActive();
  const [revision, setRevision] = useState(0);
  const request = useMemo(() => ({ key, revision }), [key, revision]);
  const [data, setData] = useState<{
    request: typeof request;
    page: AssetPage | null;
    error: string;
  } | null>(null);
  const [facets, setFacets] = useState<AssetFacets>({ groups: [], owners: [], tags: [] });
  useEffect(() => {
    if (!active || tab === "storage") return;
    let disposed = false;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      void listManagedAssets(query, abort.signal).then(
        (page) => {
          if (!disposed) setData({ request, page, error: "" });
        },
        (reason) => {
          if (!disposed)
            setData({ request, page: null, error: assetError(reason, "资产列表读取失败。") });
        },
      );
    }, 180);
    return () => {
      disposed = true;
      abort.abort();
      clearTimeout(timer);
    };
  }, [query, request, tab, active]);
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    const abort = new AbortController();
    void assetFacets(abort.signal)
      .then((value) => {
        if (!disposed) setFacets(value);
      })
      .catch(() => {
        // Optional facets do not prevent text/ID filtering when the main list is available.
      });
    return () => {
      disposed = true;
      abort.abort();
    };
  }, [revision, active]);
  return {
    page: data?.request.key === key ? data.page : null,
    error: data?.request === request ? data.error : "",
    loading: tab !== "storage" && data?.request !== request,
    facets,
    revision,
    refresh: () => setRevision((value) => value + 1),
  };
}
