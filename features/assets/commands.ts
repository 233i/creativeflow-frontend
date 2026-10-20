import type {
  AssetActionKind,
  AssetBatch,
  AssetBatchKind,
  AssetDeletionPreview,
  AssetItem,
} from "./types";

export function parseAssetTags(value: string) {
  return [
    ...new Set(
      value
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

export function assetBatchRequest(
  action: AssetBatchKind,
  assets: AssetItem[],
  reason: string,
  value: string,
): AssetBatch {
  const common = {
    ids: assets.map((asset) => asset.id),
    revisions: Object.fromEntries(assets.map((asset) => [asset.id, asset.revision])),
    reason: reason.trim(),
  };
  if (action === "group") return { ...common, action, groupName: value.trim() };
  if (action === "tags") return { ...common, action, tags: parseAssetTags(value) };
  return { ...common, action };
}

export function assetActionAllowed(
  action: AssetActionKind,
  preview: AssetDeletionPreview | null,
  history: boolean,
) {
  if (!preview) return false;
  switch (action) {
    case "purge":
      return preview.canPurge || (history && preview.canPurgeHistory);
    case "recycle":
      return preview.canRecycle;
    case "restore":
      return preview.asset.state === "recycled";
    case "publish":
      return preview.asset.state === "active" && !preview.asset.isPublic;
    case "unpublish":
      return preview.asset.state === "active" && preview.asset.isPublic;
  }
}

export function assetError(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}
