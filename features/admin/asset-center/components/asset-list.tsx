"use client";
import { AssetThumbnail } from "@/features/assets/thumbnail";
import { formatBytes, sourceLabel, stateLabel } from "@/features/assets/presentation";
import type { AssetItem, AssetPage } from "@/features/assets/types";
import type { AssetTab } from "../query-state";
import { PrimaryTable, type PrimaryTableCol } from "tdesign-react";
type ListProps = {
  items: AssetItem[];
  selectedIds: Set<string>;
  toggle: (asset: AssetItem) => void;
  refresh: number;
  onInspect: (id: string) => void;
};
export function AssetList({
  page,
  loading,
  tab,
  view,
  ...props
}: Omit<ListProps, "items"> & {
  page: AssetPage | null;
  loading: boolean;
  tab: AssetTab;
  view: "grid" | "table";
}) {
  return (
    <div className="sol-admin-table-region" aria-busy={loading}>
      {loading && !page && (
        <p className="p-8 text-center text-sm" role="status">
          读取资产…
        </p>
      )}
      {page?.total === 0 && (
        <div className="p-12 text-center">
          <h3 className="font-medium">
            {tab === "public"
              ? "还没有公共素材"
              : tab === "recycle"
                ? "回收站为空或没有匹配项"
                : "没有匹配的资产"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {tab === "public"
              ? "在资产详情中确认分享范围并发布，用户即可从素材库复用。"
              : "调整筛选条件，或上传图片。生成结果也会进入这里。"}
          </p>
        </div>
      )}
      {view === "table" ? (
        <AssetTable {...props} items={page?.items ?? []} />
      ) : (
        <AssetGrid {...props} items={page?.items ?? []} />
      )}
    </div>
  );
}
function AssetTable({ items, selectedIds, toggle, refresh, onInspect }: ListProps) {
  const columns: PrimaryTableCol<AssetItem>[] = [
    {
      colKey: "selected",
      title: "选择",
      width: 72,
      resize: { minWidth: 64, maxWidth: 96 },
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label={`选择 ${row.name}`}
          checked={selectedIds.has(row.id)}
          onChange={() => toggle(row)}
        />
      ),
    },
    {
      colKey: "asset",
      title: "资产",
      width: 300,
      resize: { minWidth: 220, maxWidth: 640 },
      cell: ({ row }) => (
        <button
          className="flex w-full min-w-0 items-center gap-3 text-left"
          onClick={() => onInspect(row.id)}
          title={row.name}
        >
          <div className="h-10 w-14 shrink-0 overflow-hidden rounded">
            <AssetThumbnail asset={row} refresh={refresh} />
          </div>
          <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
        </button>
      ),
    },
    {
      colKey: "owner",
      title: "所有者 / 来源",
      width: 176,
      resize: { minWidth: 140, maxWidth: 360 },
      cell: ({ row }) => (
        <div>
          <p className="truncate" title={row.owner}>
            {row.owner}
          </p>
          <p className="truncate text-xs text-muted-foreground">{sourceLabel(row.source)}</p>
        </div>
      ),
    },
    {
      colKey: "size",
      title: "容量",
      width: 112,
      resize: { minWidth: 96, maxWidth: 200 },
      cell: ({ row }) => formatBytes(row.byteSize),
    },
    {
      colKey: "references",
      title: "引用",
      width: 72,
      resize: { minWidth: 64, maxWidth: 140 },
      cell: ({ row }) => row.referenceCount,
    },
    {
      colKey: "state",
      title: "状态",
      width: 128,
      resize: { minWidth: 96, maxWidth: 240 },
      cell: ({ row }) => `${row.isPublic ? "公共 · " : ""}${stateLabel(row.state)}`,
    },
    {
      colKey: "createdAt",
      title: "创建时间",
      width: 192,
      resize: { minWidth: 160, maxWidth: 320 },
      cell: ({ row }) => (
        <time className="whitespace-nowrap text-xs" dateTime={row.createdAt}>
          {new Date(row.createdAt).toLocaleString()}
        </time>
      ),
    },
  ];
  return (
    <PrimaryTable
      className="sol-admin-asset-table"
      rowKey="id"
      data={items}
      columns={columns}
      hover
      bordered={false}
      disableDataPage
      tableLayout="fixed"
      resizable
      empty="暂无资产"
    />
  );
}
function AssetGrid({ items, selectedIds, toggle, refresh, onInspect }: ListProps) {
  return (
    <div className="grid grid-cols-2 gap-3 p-1 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {items.map((asset) => (
        <article
          key={asset.id}
          className={`group relative min-w-0 overflow-hidden rounded-xl border ${selectedIds.has(asset.id) ? "border-primary ring-1 ring-primary" : "hover:border-primary/40"}`}
        >
          <label className="absolute left-2 top-2 z-10 flex size-7 items-center justify-center rounded bg-background/95 shadow-sm">
            <input
              aria-label={`选择 ${asset.name}`}
              type="checkbox"
              checked={selectedIds.has(asset.id)}
              onChange={() => toggle(asset)}
            />
          </label>
          <button
            className="block w-full text-left"
            aria-label={`查看 ${asset.name}`}
            onClick={() => onInspect(asset.id)}
          >
            <div className="aspect-[4/3] overflow-hidden bg-muted">
              <AssetThumbnail asset={asset} refresh={refresh} />
            </div>
            <div className="space-y-1 p-3">
              <h3 className="truncate text-sm font-medium" title={asset.name}>
                {asset.name}
              </h3>
              <p className="flex justify-between gap-1 text-xs text-muted-foreground">
                <span className="truncate">{asset.owner}</span>
                <span className="shrink-0">{formatBytes(asset.byteSize)}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {asset.isPublic ? "公共素材 · " : ""}
                {sourceLabel(asset.source)} · {asset.referenceCount} 处引用
                {asset.state !== "active" ? ` · ${stateLabel(asset.state)}` : ""}
              </p>
            </div>
          </button>
        </article>
      ))}
    </div>
  );
}
