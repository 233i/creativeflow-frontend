import type { LibraryData } from "./types";
import type { AssetQuery } from "@/features/assets/types";

/** Only page items change locally; group totals also account for assets on other pages. */
export function moveLibraryAssets(
  data: LibraryData,
  ids: string[],
  groupId: string | null,
  query: AssetQuery,
): LibraryData {
  const moving = new Set(ids);
  const assets = data.assets.map((asset) => (moving.has(asset.id) ? { ...asset, groupId } : asset));
  const groups = data.groups.map((group) => {
    const delta = data.assets.reduce((count, asset) => {
      if (!moving.has(asset.id)) return count;
      return count + Number(groupId === group.id) - Number(asset.groupId === group.id);
    }, 0);
    return delta ? { ...group, assetCount: Math.max(0, group.assetCount + delta) } : group;
  });
  const visible = (items: typeof assets) =>
    items.filter(
      (asset) =>
        (!query.groupId || asset.groupId === query.groupId) && (!query.ungrouped || !asset.groupId),
    ).length;
  return {
    assets,
    groups,
    total: Math.max(0, data.total + visible(assets) - visible(data.assets)),
  };
}
