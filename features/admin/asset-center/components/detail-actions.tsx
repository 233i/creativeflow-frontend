"use client";
import { Button } from "@/components/ui/button";
import type { AssetItem, AssetActionKind } from "@/features/assets/types";
export function AssetDetailActions({
  asset,
  onAction,
}: {
  asset: AssetItem;
  onAction: (asset: AssetItem, action: AssetActionKind) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {asset.state === "active" && (
        <>
          <Button
            size="sm"
            variant="outline"
            onPress={() => onAction(asset, asset.isPublic ? "unpublish" : "publish")}
          >
            {asset.isPublic ? "下架公共素材" : "发布公共素材"}
          </Button>
          <Button size="sm" variant="outline" onPress={() => onAction(asset, "recycle")}>
            移入回收站
          </Button>
        </>
      )}
      {asset.state === "recycled" && (
        <Button size="sm" variant="outline" onPress={() => onAction(asset, "restore")}>
          恢复
        </Button>
      )}
      {(asset.state === "recycled" || asset.state === "cleaning") && (
        <Button size="sm" variant="destructive" onPress={() => onAction(asset, "purge")}>
          {asset.state === "cleaning" ? "检查清理状态" : "永久清理"}
        </Button>
      )}
    </div>
  );
}
