"use client";

import { FolderOpen, Loader2 } from "lucide-react";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import type { AssetItem } from "@/features/assets/types";
import type { LibraryController } from "../controllers/use-library-controller";
import { AssetTile } from "./asset-tile";
import { EmptyLibrary } from "./empty-library";

export function LibraryCollection({ controller }: { controller: LibraryController }) {
  const t = useT();
  const { query, picking } = controller;
  if (query.loading && !query.assets.length)
    return (
      <div
        className="flex h-48 items-center justify-center"
        role="status"
        aria-label={t("common.loading")}
      >
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  if (!query.assets.length) return <EmptyLibrary />;
  if (!query.visibleAssets.length)
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
        <FolderOpen className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm">{t("canvas.assetGroupNoAssets")}</p>
        {!picking && (
          <p className="max-w-sm text-xs text-muted-foreground">
            {t("canvas.assetGroupEmptyHint")}
          </p>
        )}
      </div>
    );
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {query.visibleAssets.map((asset) => (
        <LibraryAssetCard key={asset.id} asset={asset} controller={controller} />
      ))}
    </div>
  );
}
function LibraryAssetCard({
  asset,
  controller,
}: {
  asset: AssetItem;
  controller: LibraryController;
}) {
  const { picking, source, filters, query, selection, commands, groups, assets } = controller;
  const readOnly = picking || filters.section !== "mine" || !asset.canManage;
  return (
    <div className="min-w-0">
      <AssetTile
        key={`${asset.id}:${query.revision}`}
        asset={source ? { ...asset, thumbnailUrl: source.assetUrl(asset.thumbnailUrl) } : asset}
        selected={selection.selectedIds.has(asset.id)}
        readOnly={readOnly}
        busy={!!commands.busy}
        onToggle={() => {
          if (filters.section !== "recycle" && !commands.busy) selection.toggle(asset);
        }}
        onDelete={() => assets.setDeletingId(asset.id)}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/asset-id", asset.id);
          groups.setDragged(asset.id);
        }}
        onDragEnd={() => {
          groups.setDragged(null);
          groups.setDragOver(null);
        }}
      />
      <p className="mt-1 truncate text-xs" title={asset.name}>
        {asset.name}
      </p>
      {!picking && filters.section === "recycle" && (
        <Button
          size="xs"
          variant="outline"
          isDisabled={!!commands.busy || !asset.canManage || asset.state !== "recycled"}
          onPress={() => void assets.restore(asset)}
        >
          恢复素材
        </Button>
      )}
    </div>
  );
}
