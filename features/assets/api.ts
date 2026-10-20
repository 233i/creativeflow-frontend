import { createApiClient } from "@/lib/api-client";
import type {
  AssetItem,
  AssetPage,
  AssetQuery,
  AssetFacets,
  AssetDetail,
  AssetDeletionPreview,
  AssetAction,
  AssetActionKind,
  AssetResult,
  AssetBatch,
  AssetStorage,
  AssetPolicy,
} from "./types";
export type * from "./types";
// Compatibility exports; new views import presentation directly.
export { sourceLabel, stateLabel, formatBytes, sourceLink } from "./presentation";

export class AssetApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AssetApiError";
  }
}
export function assetClient(baseUrl: string) {
  return createApiClient({
    baseUrl,
    networkErrorMessage: "资产请求未完成，请重新查询确认状态。",
    createError: ({ status, details, fallbackMessage }) =>
      new AssetApiError(
        details[0] ?? (status === 401 ? "登录已失效，请重新登录。" : fallbackMessage),
        status,
      ),
  });
}
const admin = assetClient("/api/v1/admin/assets");
const library = assetClient("/api/v1/canvas/asset-library");
export function assetQueryString(query: AssetQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== "") params.set(key, String(value));
  return params.toString();
}
export const listManagedAssets = (query: AssetQuery, signal?: AbortSignal): Promise<AssetPage> =>
  admin(`?${assetQueryString(query)}`, { signal, cache: "no-store" });
export const listLibraryAssets = (query: AssetQuery, signal?: AbortSignal): Promise<AssetPage> =>
  library(`?${assetQueryString(query)}`, { signal, cache: "no-store" });
export const assetFacets = (signal?: AbortSignal): Promise<AssetFacets> =>
  admin("/facets", { signal, cache: "no-store" });
export const getManagedAsset = (id: string, signal?: AbortSignal): Promise<AssetDetail> =>
  admin(`/${encodeURIComponent(id)}`, { signal, cache: "no-store" });
export const getLibraryAsset = (id: string): Promise<AssetDetail> =>
  library(`/${encodeURIComponent(id)}`, { cache: "no-store" });
export const previewAssetDeletion = (
  id: string,
  signal?: AbortSignal,
): Promise<AssetDeletionPreview> =>
  admin(`/${encodeURIComponent(id)}/deletion-preview`, { signal, cache: "no-store" });
export const updateManagedAsset = (
  id: string,
  value: { name: string; tags: string[]; revision: string; reason: string },
): Promise<AssetResult> =>
  admin(`/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(value) });
export const manageAsset = (
  id: string,
  action: AssetActionKind,
  value: AssetAction,
): Promise<AssetResult> =>
  admin(`/${encodeURIComponent(id)}/${action}`, { method: "POST", body: JSON.stringify(value) });
export const batchAssets = (value: AssetBatch): Promise<AssetResult[]> =>
  admin("/batch", { method: "POST", body: JSON.stringify(value) });
export const assetStorage = (signal?: AbortSignal): Promise<AssetStorage> =>
  admin("/storage", { signal, cache: "no-store" });
export const setAssetPolicy = (value: AssetPolicy): Promise<void> =>
  admin("/storage-policy", { method: "PUT", body: JSON.stringify(value) });
export const reusePublicAsset = (id: string, revision: string): Promise<AssetItem> =>
  library(`/public/${encodeURIComponent(id)}/reuse`, {
    method: "POST",
    body: JSON.stringify({ revision }),
  });
export const restoreLibraryAsset = (asset: AssetItem): Promise<AssetResult> =>
  library(`/${encodeURIComponent(asset.id)}/restore`, {
    method: "POST",
    body: JSON.stringify({ revision: asset.revision, reason: "从素材库恢复" }),
  });
export const uploadManagedAsset = (file: File): Promise<{ assetId: string }> => {
  const body = new FormData();
  body.append("file", file);
  return admin("/upload", { method: "POST", body });
};
export const extractManagedFrame = (id: string): Promise<{ assetId: string }> =>
  admin(`/${encodeURIComponent(id)}/last-frame`, { method: "POST" });

/** 不重试打包请求；失败时显示服务端原因，而不是下载一份错误 JSON。 */
export async function downloadAssets(ids: string[], administrative = true) {
  const response = await fetch(
    administrative ? "/api/v1/admin/assets/download" : "/api/v1/canvas/asset-library/download",
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new AssetApiError(
      body?.details?.[0] ?? "打包下载失败，请检查权限、原件状态及 512 MiB 大小限制。",
      response.status,
    );
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = "CreativeFlow-assets.zip";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
