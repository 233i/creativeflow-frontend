"use client";
import { useT } from "@/components/providers/i18n-provider";
import { Folder, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type * as api from "../../api";
export function GroupNavRow({
  group,
  active,
  editing,
  draft,
  busy,
  isDragOver,
  onSelect,
  onRename,
  onDelete,
  onDraftChange,
  onCommit,
  onCancel,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  group: api.CanvasAssetGroupSummary;
  active: boolean;
  editing: boolean;
  draft: string;
  busy: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDraftChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
}) {
  const t = useT();

  if (editing) {
    return (
      <div className="flex items-center gap-1 rounded-md bg-accent/50 p-1">
        <Input
          autoFocus
          maxLength={64}
          value={draft}
          aria-label={t("canvas.assetGroupNamePlaceholder")}
          className="h-6 min-w-0 flex-1 text-xs"
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onCommit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onCancel();
            }
          }}
          onBlur={onCommit}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex min-h-8 items-center rounded-md transition-colors",
        active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
        isDragOver && "bg-primary/10 ring-1 ring-primary/40",
        busy && "pointer-events-none opacity-60",
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <button
        type="button"
        aria-current={active ? "page" : undefined}
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-xs"
        onClick={onSelect}
        title={t("canvas.assetGroupDragHint")}
      >
        <Folder className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{group.name}</span>
        <span className="text-[0.625rem] tabular-nums text-muted-foreground">
          {group.assetCount}
        </span>
      </button>
      <button
        type="button"
        aria-label={t("canvas.assetGroupRename")}
        title={t("canvas.assetGroupRename")}
        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background focus-visible:opacity-100 group-hover:opacity-100"
        onClick={onRename}
      >
        <Pencil className="size-3" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={t("canvas.assetGroupDelete")}
        title={t("canvas.assetGroupDelete")}
        className="mr-1 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        onClick={onDelete}
      >
        <Trash2 className="size-3" aria-hidden />
      </button>
    </div>
  );
}
