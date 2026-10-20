"use client";

import { useId, useState } from "react";
import { ChevronDown, Grid2X2, List, Search, SlidersHorizontal } from "lucide-react";
import { AutoComplete, Button, Checkbox, Input } from "tdesign-react";
import { sourceLabel } from "@/features/assets/presentation";
import type { AssetFacets } from "@/features/assets/types";
import type { CenterQuery } from "../controllers/use-center-query";
import { clearedAssetFilters } from "../query-state";
import { FilterDate, FilterSelect } from "./filter-controls";

type Props = { route: CenterQuery; facets: AssetFacets };

export function AssetFilters(props: Props) {
  return (
    <div
      className="mb-3 max-h-[50dvh] shrink-0 space-y-2 overflow-y-auto px-0.5 py-0.5"
      role="search"
      aria-label="资产筛选"
    >
      <BasicFilters {...props} />
      <AdvancedFilters {...props} />
    </div>
  );
}

function BasicFilters({ route, facets }: Props) {
  const { query, view, setView, filter } = route;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="min-w-0 basis-full sm:min-w-60 sm:flex-1">
        <span className="sr-only">搜索资产</span>
        <Input
          placeholder="搜索名称、提示词、用户或资产 ID"
          prefixIcon={<Search size={16} />}
          clearable
          maxlength={200}
          value={query.search}
          onChange={(value) => filter({ q: String(value) })}
        />
      </label>
      <FilterSelect
        label="资产类型"
        placeholder="全部类型"
        value={query.kind}
        onChange={(kind) => filter({ kind })}
        options={[
          { value: "", label: "全部类型" },
          { value: "image", label: "图片" },
          { value: "video", label: "视频" },
        ]}
      />
      <FilterSelect
        label="资产来源"
        placeholder="全部来源"
        value={query.source}
        onChange={(source) => filter({ source })}
        options={[
          { value: "", label: "全部来源" },
          ...["upload", "generated", "derived", "reused", "unknown"].map((value) => ({
            value,
            label: sourceLabel(value),
          })),
        ]}
      />
      <FilterSelect
        label="资产所有者"
        placeholder="全部用户"
        filterable
        value={query.accountId ?? ""}
        onChange={(accountId) => filter({ accountId })}
        options={[
          { value: "", label: "全部用户" },
          ...facets.owners.map((f) => ({ value: f.id, label: `${f.name} · ${f.id.slice(0, 8)}` })),
        ]}
      />
      <FilterSelect
        label="资产排序"
        value={query.sort}
        onChange={(sort) => filter({ sort })}
        options={[
          { value: "created_desc", label: "最新创建" },
          { value: "created_asc", label: "最早创建" },
          { value: "size_desc", label: "最大文件" },
          { value: "name_asc", label: "名称排序" },
        ]}
      />
      <div className="flex gap-1" role="group" aria-label="资产展示方式">
        <Button
          shape="square"
          theme={view === "grid" ? "primary" : "default"}
          variant={view === "grid" ? "base" : "outline"}
          aria-label="网格视图"
          aria-pressed={view === "grid"}
          icon={<Grid2X2 size={16} />}
          onClick={() => setView("grid")}
        />
        <Button
          shape="square"
          theme={view === "table" ? "primary" : "default"}
          variant={view === "table" ? "base" : "outline"}
          aria-label="列表视图"
          aria-pressed={view === "table"}
          icon={<List size={16} />}
          onClick={() => setView("table")}
        />
      </div>
    </div>
  );
}

function AdvancedFilters({ route, facets }: Props) {
  const { query, params, tab, filter } = route;
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  return (
    <div>
      <Button
        variant="text"
        icon={<SlidersHorizontal size={16} />}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded(!expanded)}
      >
        更多筛选
        <ChevronDown size={14} className={expanded ? "rotate-180" : undefined} />
      </Button>
      <div id={panelId} hidden={!expanded}>
        <div className="mt-2 flex flex-wrap items-end gap-3 rounded-lg border bg-muted/20 p-3">
          <FilterSelect
            label="资产文件夹"
            placeholder="全部文件夹"
            filterable
            value={query.ungrouped ? "ungrouped" : (query.groupId ?? "")}
            onChange={(value) =>
              filter({
                group: value === "ungrouped" ? null : value,
                ungrouped: value === "ungrouped" ? "1" : null,
              })
            }
            options={[
              { value: "", label: "全部文件夹" },
              { value: "ungrouped", label: "未分组" },
              ...facets.groups.map((f) => ({ value: f.id, label: `${f.name} · ${f.count}` })),
            ]}
          />
          <label className="min-w-0 basis-2/5 grow sm:w-40 sm:basis-auto sm:grow-0">
            <span className="sr-only">标签筛选</span>
            <AutoComplete
              placeholder="输入或选择标签"
              clearable
              inputProps={{ maxlength: 40 }}
              value={query.tag}
              options={facets.tags}
              onChange={(tag) => filter({ tag })}
            />
          </label>
          <FilterSelect
            label="引用筛选"
            placeholder="全部引用状态"
            value={query.usage}
            onChange={(usage) => filter({ usage })}
            options={[
              { value: "", label: "全部引用状态" },
              { value: "referenced", label: "有引用" },
              { value: "unreferenced", label: "无引用" },
              ...(tab === "recycle" ? [{ value: "purgeable", label: "可安全清理" }] : []),
            ]}
          />
          <FilterDate
            label="创建起始日期"
            value={params.get("from")}
            onChange={(from) => filter({ from })}
          />
          <FilterDate
            label="创建截止日期"
            value={params.get("to")}
            onChange={(to) => filter({ to })}
          />
          <div className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2">
            <Checkbox
              checked={params.get("large") === "1"}
              onChange={(checked) => filter({ large: checked ? "1" : null })}
            >
              ≥ 10 MiB
            </Checkbox>
            {tab === "all" && (
              <Checkbox
                checked={params.get("purged") === "1"}
                onChange={(checked) => filter({ purged: checked ? "1" : null })}
              >
                仅已清理记录
              </Checkbox>
            )}
            <Button theme="primary" variant="text" onClick={() => filter(clearedAssetFilters())}>
              清空筛选
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
