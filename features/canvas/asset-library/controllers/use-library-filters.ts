"use client";

import { useMemo, useState } from "react";
import type { AssetQuery } from "@/features/assets/types";
import { ALL_ASSETS, UNGROUPED_ASSETS, type LibrarySection } from "../types";

export function useLibraryFilters(picking: boolean) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [section, setSection] = useState<LibrarySection>("mine");
  const [activeGroupId, setGroup] = useState(ALL_ASSETS);
  const [page, setPage] = useState(0);
  const query = useMemo<AssetQuery>(
    () => ({
      search,
      kind: picking ? "image" : kind,
      state: section === "recycle" ? "recycled" : "active",
      public: section === "public",
      groupId:
        section === "mine" && ![ALL_ASSETS, UNGROUPED_ASSETS].includes(activeGroupId)
          ? activeGroupId
          : undefined,
      ungrouped: section === "mine" && activeGroupId === UNGROUPED_ASSETS,
      offset: page * 24,
      limit: 24,
    }),
    [search, kind, picking, section, activeGroupId, page],
  );
  return {
    query,
    search,
    kind,
    section,
    activeGroupId,
    page,
    chooseGroup: (id: string) => {
      setGroup(id);
      setPage(0);
    },
    chooseSection: (value: LibrarySection) => {
      setSection(value);
      setGroup(ALL_ASSETS);
      setPage(0);
    },
    changeSearch: (value: string) => {
      setSearch(value);
      setPage(0);
    },
    changeKind: (value: string) => {
      setKind(value);
      setPage(0);
    },
    setPage,
  };
}
export type LibraryFilters = ReturnType<typeof useLibraryFilters>;
