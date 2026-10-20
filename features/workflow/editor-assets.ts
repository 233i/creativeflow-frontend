import type { UploadedAsset } from "@/features/ai/api";
import type { AssetItem, AssetPage, AssetQuery } from "@/features/assets/api";
import type { CanvasAssetGroupSummary, CanvasAssetSummary } from "@/features/canvas/api";

/** 编辑器需要的素材能力；管理入口和普通画布各自提供认证与传输实现。 */
export interface WorkflowEditorAssets {
  listAssets: () => Promise<{ assets: CanvasAssetSummary[] }>;
  listAssetPage: (query: AssetQuery) => Promise<AssetPage>;
  reusePublicAsset: (id: string, revision: string) => Promise<AssetItem>;
  listAssetGroups: () => Promise<{ groups: CanvasAssetGroupSummary[] }>;
  uploadAsset: (file: File) => Promise<UploadedAsset>;
  assetUrl: (url: string) => string;
}
