"use client";

import { useRef, useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import * as api from "../../api";
import { assetError } from "@/features/assets/commands";
import { moveLibraryAssets } from "../group-projection";
import { UNGROUPED_ASSETS } from "../types";
import type { LibraryQuery } from "./use-library-query";
import type { LibraryFilters } from "./use-library-filters";
import type { LibraryCommands } from "./use-library-commands";

export function useLibraryGroups(
  query: LibraryQuery,
  filters: LibraryFilters,
  commands: LibraryCommands,
  picking: boolean,
) {
  const t = useT();
  const manageable = !picking && filters.section === "mine" && !query.loading;
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const editingId = useRef<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<api.CanvasAssetGroupSummary | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const groupError = (reason: unknown) =>
    reason instanceof api.CanvasApiError && reason.status === 409
      ? t("canvas.assetGroupNameDuplicate")
      : assetError(reason, t("errors.unknown"));

  async function create() {
    if (!manageable) return;
    const name = newName.trim();
    if (!name) {
      commands.setError(t("canvas.assetGroupNameRequired"));
      return;
    }
    await commands.perform(
      "create-group",
      async (current) => {
        const created = await api.createAssetGroup(name);
        if (!current()) return;
        query.update((data) => ({ ...data, groups: [...data.groups, created] }));
        filters.chooseGroup(created.id);
        setNewName("");
        setCreating(false);
      },
      groupError,
    );
  }
  function beginRename(group: api.CanvasAssetGroupSummary) {
    if (!manageable || commands.busy) return;
    editingId.current = group.id;
    setEditing({ id: group.id, name: group.name });
  }
  function abandonRename() {
    editingId.current = null;
    setEditing(null);
  }
  async function commitRename(id: string) {
    if (!manageable || commands.busy || editingId.current !== id) return;
    const name = editing?.name.trim();
    abandonRename();
    const original = query.groups.find((group) => group.id === id);
    if (!name || !original || name === original.name) return;
    await commands.perform(
      "rename-group",
      async (current) => {
        const updated = await api.renameAssetGroup(id, name);
        if (current())
          query.update((data) => ({
            ...data,
            groups: data.groups.map((group) => (group.id === id ? updated : group)),
          }));
      },
      groupError,
    );
  }
  async function remove(group: api.CanvasAssetGroupSummary) {
    if (!manageable) return;
    await commands.perform("delete-group", async (current) => {
      await api.deleteAssetGroup(group.id);
      if (!current()) return;
      query.update((data) => ({
        ...data,
        groups: data.groups.filter((candidate) => candidate.id !== group.id),
        assets: data.assets.map((asset) =>
          asset.groupId === group.id ? { ...asset, groupId: null } : asset,
        ),
      }));
      if (filters.activeGroupId === group.id) filters.chooseGroup(UNGROUPED_ASSETS);
      setPendingDelete(null);
    });
  }
  async function move(ids: string[], groupId: string | null) {
    if (!manageable || !ids.length) return;
    if (ids.some((id) => !query.assets.some((asset) => asset.id === id && asset.canManage))) return;
    await commands.perform("assign", async (current) => {
      const previous = { assets: query.assets, groups: query.groups, total: query.total };
      query.update(() => moveLibraryAssets(previous, ids, groupId, filters.query));
      try {
        await api.assignAssetsToGroup(ids, groupId);
      } catch (reason) {
        if (current()) query.update(() => previous);
        throw reason;
      }
    });
  }
  function drop(event: React.DragEvent, groupId: string | null, selected: string[]) {
    event.preventDefault();
    setDragOver(null);
    if (!manageable) return;
    const id = event.dataTransfer.getData("text/asset-id") || dragged;
    if (id) void move(selected.includes(id) ? selected : [id], groupId);
    setDragged(null);
  }
  return {
    creating,
    setCreating,
    newName,
    setNewName,
    editing,
    setEditing,
    pendingDelete,
    setPendingDelete,
    dragged,
    setDragged,
    dragOver,
    setDragOver,
    create,
    beginRename,
    abandonRename,
    commitRename,
    remove,
    move,
    drop,
  };
}
export type LibraryGroups = ReturnType<typeof useLibraryGroups>;
