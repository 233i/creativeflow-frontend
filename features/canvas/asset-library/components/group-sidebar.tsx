"use client";
import { useT } from "@/components/providers/i18n-provider";
import { Check, Folder, FolderOpen, FolderPlus, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALL_ASSETS, UNGROUPED_ASSETS } from "../types";
import type { LibraryController } from "../controllers/use-library-controller";
import { LibraryNavButton } from "./nav-button";
import { GroupNavRow } from "./group-nav-row";
export function LibraryGroupSidebar({ controller }: { controller: LibraryController }) {
  const t = useT();
  const { picking, filters, query, commands, groups: actions, selection } = controller;
  function dropOnGroup(event: React.DragEvent, groupId: string | null) {
    actions.drop(
      event,
      groupId,
      selection.selected.map((asset) => asset.id),
    );
  }
  function setEditingName(name: string) {
    actions.setEditing((value) => (value ? { ...value, name } : value));
  }
  return (
    <aside className="flex max-h-44 w-full shrink-0 flex-col border-b pb-3 sm:max-h-none sm:w-48 sm:border-r sm:border-b-0 sm:pr-3 sm:pb-0">
      <div className="flex flex-col gap-1">
        <LibraryNavButton
          icon={ImageIcon}
          label={t("canvas.assetAll")}
          count={filters.activeGroupId === ALL_ASSETS ? query.total : undefined}
          active={filters.activeGroupId === ALL_ASSETS}
          onPress={() => filters.chooseGroup(ALL_ASSETS)}
        />
        <LibraryNavButton
          icon={FolderOpen}
          label={t("canvas.assetUngrouped")}
          count={filters.activeGroupId === UNGROUPED_ASSETS ? query.total : undefined}
          active={filters.activeGroupId === UNGROUPED_ASSETS}
          onPress={() => filters.chooseGroup(UNGROUPED_ASSETS)}
          dropTarget={!picking}
          isDragOver={actions.dragOver === UNGROUPED_ASSETS}
          onDragOver={(event) => {
            event.preventDefault();
            actions.setDragOver(UNGROUPED_ASSETS);
          }}
          onDragLeave={() => actions.setDragOver(null)}
          onDrop={(event) => dropOnGroup(event, null)}
        />
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
            {t("canvas.assetGroups")}
          </span>
          {!picking && (
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={t("canvas.assetGroupCreate")}
              onPress={() => {
                actions.setCreating(true);
                commands.setError(null);
              }}
              isDisabled={Boolean(commands.busy)}
            >
              <FolderPlus className="size-3.5" aria-hidden />
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-0.5">
          {query.groups.length === 0 ? (
            <div className="px-1 py-3 text-[0.6875rem] leading-relaxed text-muted-foreground">
              <p>{t("canvas.assetGroupEmpty")}</p>
              {!picking && <p className="mt-1 opacity-75">{t("canvas.assetGroupEmptyHint")}</p>}
            </div>
          ) : (
            query.groups.map((group) =>
              picking ? (
                <LibraryNavButton
                  key={group.id}
                  icon={Folder}
                  label={group.name}
                  count={group.assetCount}
                  active={filters.activeGroupId === group.id}
                  onPress={() => filters.chooseGroup(group.id)}
                />
              ) : (
                <GroupNavRow
                  key={group.id}
                  group={group}
                  active={filters.activeGroupId === group.id}
                  editing={actions.editing?.id === group.id}
                  draft={actions.editing?.name ?? ""}
                  busy={commands.busy === "rename-group" || commands.busy === "delete-group"}
                  isDragOver={actions.dragOver === group.id}
                  onSelect={() => filters.chooseGroup(group.id)}
                  onRename={() => actions.beginRename(group)}
                  onDelete={() => actions.setPendingDelete(group)}
                  onDraftChange={setEditingName}
                  onCommit={() => void actions.commitRename(group.id)}
                  onCancel={actions.abandonRename}
                  onDragOver={(event) => {
                    event.preventDefault();
                    actions.setDragOver(group.id);
                  }}
                  onDragLeave={() => actions.setDragOver(null)}
                  onDrop={(event) => dropOnGroup(event, group.id)}
                />
              ),
            )
          )}
        </div>
      </div>

      {actions.creating && (
        <div className="mt-2 flex gap-1">
          <Input
            autoFocus
            maxLength={64}
            value={actions.newName}
            placeholder={t("canvas.assetGroupNamePlaceholder")}
            aria-label={t("canvas.assetGroupNamePlaceholder")}
            className="h-7 min-w-0 flex-1 text-xs"
            onChange={(event) => actions.setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void actions.create();
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                actions.setCreating(false);
                actions.setNewName("");
              }
            }}
            onBlur={() => {
              // 失焦时不提交；点击加号按钮不应创建空文件夹，Escape 也应始终可靠地放弃草稿。
            }}
          />
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={t("common.add")}
            onPress={() => void actions.create()}
            isDisabled={Boolean(commands.busy)}
          >
            {commands.busy === "create-group" ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : (
              <Check className="size-3" aria-hidden />
            )}
          </Button>
        </div>
      )}
    </aside>
  );
}
