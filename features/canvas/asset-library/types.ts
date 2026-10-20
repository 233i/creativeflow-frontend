import type { CanvasAssetSummary, CanvasAssetGroupSummary } from "../api";
import type { AssetItem, AssetPage, AssetQuery } from "@/features/assets/types";

export interface LibrarySource {
  listAssets: () => Promise<{ assets: CanvasAssetSummary[] }>;
  listAssetPage: (query: AssetQuery) => Promise<AssetPage>;
  reusePublicAsset: (id: string, revision: string) => Promise<AssetItem>;
  listAssetGroups: () => Promise<{ groups: CanvasAssetGroupSummary[] }>;
  assetUrl: (url: string) => string;
}
export type AssetLibraryDialogProps = { onOpenChange: (open: boolean) => void } & (
  | { mode?: "insert"; at: () => { x: number; y: number } }
  | {
      mode: "select";
      source?: LibrarySource;
      selectedAssetUrl?: string;
      onSelect: (asset: CanvasAssetSummary) => void;
    }
);
export type LibrarySection = "mine" | "public" | "recycle";
export const ALL_ASSETS = "__all__";
export const UNGROUPED_ASSETS = "__ungrouped__";
export interface LibraryData {
  assets: AssetItem[];
  groups: CanvasAssetGroupSummary[];
  total: number;
}
