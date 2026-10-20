"use client";

import type { CenterQuery } from "../controllers/use-center-query";

export function AssetCenterTabs({ tab, filter }: Pick<CenterQuery, "tab" | "filter">) {
  return (
    <div className="mb-3 flex shrink-0 gap-2 border-b" role="tablist" aria-label="资产视图">
      {[
        ["all", "全部资产"],
        ["public", "公共素材"],
        ["recycle", "回收站"],
        ["storage", "存储统计"],
      ].map(([value, label]) => (
        <button
          key={value}
          role="tab"
          aria-selected={tab === value}
          className={`border-b-2 px-3 py-2 text-sm ${value === tab ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground"}`}
          onClick={() =>
            filter({
              assetTab: value === "all" ? null : value,
              usage: null,
              purged: null,
              asset: null,
            })
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}
