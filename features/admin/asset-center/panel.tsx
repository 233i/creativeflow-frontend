"use client";

import { Button } from "@/components/ui/button";
import { useAssetSelection } from "@/features/assets/selection";
import type {
  AssetActionKind,
  AssetBatchKind,
  AssetItem,
  AssetResult,
} from "@/features/assets/types";
import { useState } from "react";
import { AssetActionDialog } from "./action-dialog";
import { AssetList } from "./components/asset-list";
import { AssetBatchDialog } from "./components/batch-dialog";
import { AssetBatchResults } from "./components/batch-results";
import { AssetFilters } from "./components/filters";
import { AssetCenterHeader } from "./components/header";
import { AssetPagination } from "./components/pagination";
import { AssetSelectionToolbar } from "./components/selection-toolbar";
import { AssetCenterTabs } from "./components/tabs";
import { useCenterCommands } from "./controllers/use-center-commands";
import { useCenterQuery } from "./controllers/use-center-query";
import { useManagedAssets } from "./controllers/use-managed-assets";
import { AssetDetailDrawer } from "./detail";
import { AssetStoragePanel } from "./storage";

/** The URL owns query scope; dialogs capture the exact assets and revisions confirmed by the user. */
export function AssetCenterPanel() {
  const route = useCenterQuery();
  const data = useManagedAssets(route);
  const selectionScope = data.error ? `${route.key}:unavailable` : route.key;
  const selection = useAssetSelection(selectionScope, data.page?.items ?? []);
  const commands = useCenterCommands(changed);
  const [action, setAction] = useState<{ asset: AssetItem; action: AssetActionKind } | null>(null);
  const [batch, setBatch] = useState<{ assets: AssetItem[]; action: AssetBatchKind } | null>(null);
  const [results, setResults] = useState<AssetResult[]>([]);
  function changed(message: string) {
    commands.setNotice(message);
    selection.clear();
    data.refresh();
  }
  function refresh() {
    commands.clearError();
    data.refresh();
  }
  const notice = commands.progress || commands.notice;
  const error = commands.error || data.error;
  return (
    <section className="sol-admin-panel relative" aria-label="资产中心">
      <AssetCenterHeader
        page={data.page}
        tab={route.tab}
        busy={commands.busy}
        onRefresh={refresh}
        upload={commands.upload}
      />
      <AssetCenterTabs tab={route.tab} filter={route.filter} />
      {notice && (
        <p role="status" className="mb-2 shrink-0 rounded-lg bg-muted px-3 py-2 text-sm">
          {notice}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="mb-2 flex shrink-0 items-center justify-between gap-2 rounded-lg bg-destructive/5 p-3 text-sm text-destructive"
        >
          <p className="max-h-24 overflow-y-auto">{error}</p>
          <Button size="sm" variant="outline" onPress={refresh}>
            重新查询
          </Button>
        </div>
      )}
      {route.tab === "storage" ? (
        <AssetStoragePanel refresh={data.revision} onClean={route.showCleanable} />
      ) : (
        <>
          <AssetFilters route={route} facets={data.facets} />
          <AssetSelectionToolbar
            page={data.page}
            loading={data.loading}
            selection={selection}
            busy={commands.busy}
            tab={route.tab}
            download={() => commands.download(selection.selected)}
            onBatch={(action) => setBatch({ action, assets: selection.selected })}
          />
          <AssetList
            page={data.page}
            loading={data.loading}
            tab={route.tab}
            view={route.view}
            selectedIds={selection.selectedIds}
            toggle={selection.toggle}
            refresh={data.revision}
            onInspect={route.showDetail}
          />
          <AssetPagination
            page={data.page}
            loading={data.loading}
            pageNumber={route.pageNumber}
            query={route.query}
            setPage={route.setPage}
          />
        </>
      )}
      {route.detailId && (
        <AssetDetailDrawer
          key={route.detailId}
          id={route.detailId}
          revision={data.revision}
          onClose={() => route.showDetail(null)}
          onChanged={changed}
          onAction={(asset, action) => setAction({ asset, action })}
          onSelect={route.showDetail}
        />
      )}
      {action && (
        <AssetActionDialog
          key={`${action.asset.id}:${action.action}`}
          {...action}
          onClose={() => setAction(null)}
          onDone={(message) => {
            setAction(null);
            changed(message);
          }}
        />
      )}
      {batch && (
        <AssetBatchDialog
          {...batch}
          onClose={() => setBatch(null)}
          onDone={(value) => {
            setBatch(null);
            setResults(value);
            changed("批量操作已返回逐项结果。");
          }}
        />
      )}
      {results.length > 0 && <AssetBatchResults results={results} onClose={() => setResults([])} />}
    </section>
  );
}
