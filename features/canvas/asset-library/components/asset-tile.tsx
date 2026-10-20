"use client";
import { useT } from "@/components/providers/i18n-provider";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssetThumbnail } from "@/features/assets/thumbnail";
import type { AssetItem } from "@/features/assets/types";
import { cn } from "@/lib/utils";
export function AssetTile({
  asset,
  selected,
  readOnly,
  busy,
  onToggle,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  asset: AssetItem;
  selected: boolean;
  readOnly: boolean;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
}) {
  const t = useT();

  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={asset.name || t("canvas.assetSelect")}
        aria-pressed={selected}
        onClick={onToggle}
        draggable={!readOnly}
        onDragStart={readOnly ? undefined : onDragStart}
        onDragEnd={readOnly ? undefined : onDragEnd}
        title={asset.name}
        className={cn(
          "block aspect-square w-full overflow-hidden rounded-lg border-2 bg-muted/20 transition-all",
          selected
            ? "border-primary shadow-[0_0_0_2px_color-mix(in_oklab,var(--primary)_20%,transparent)]"
            : "border-transparent hover:border-border",
          busy && "cursor-wait opacity-60",
        )}
      >
        <AssetThumbnail asset={asset} />
        {selected && (
          <span className="absolute top-1 left-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Check className="size-3" aria-hidden />
          </span>
        )}
      </button>

      {!readOnly && (
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={t("common.delete")}
          className="absolute top-1 right-1 size-5 bg-background/80 opacity-0 transition-opacity group-hover:opacity-100"
          onPress={onDelete}
          isDisabled={busy}
        >
          <Trash2 className="size-2.5" aria-hidden />
        </Button>
      )}
    </div>
  );
}
