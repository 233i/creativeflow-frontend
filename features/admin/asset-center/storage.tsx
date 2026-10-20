"use client";

import { Button } from "@/components/ui/button";
import { useAssetStorage } from "./controllers/use-asset-storage";
import { AssetStorageSummary } from "./components/storage-summary";
import { AssetStoragePolicy } from "./components/storage-policy";

/** Statistics and policy updates never start cleanup; the host opens a separate candidate list. */
export function AssetStoragePanel({ refresh, onClean }: { refresh: number; onClean: () => void }) {
  const controller = useAssetStorage(refresh);
  const { data, error, notice, retry } = controller;
  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-4">
      {error && (
        <div role="alert" className="text-destructive">
          {error}
          <Button variant="link" onPress={retry}>
            重新查询
          </Button>
        </div>
      )}
      {notice && (
        <p role="status" className="text-sm text-primary">
          {notice}
        </p>
      )}
      {!data && !error && <p role="status">读取容量统计…</p>}
      {data && (
        <>
          <AssetStorageSummary data={data} onClean={onClean} />
          <AssetStoragePolicy controller={controller} />
        </>
      )}
    </div>
  );
}
