"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CenterQuery } from "./api";

const quickViews = [
  ["", "全部"],
  ["api", "已开放 API"],
  ["template", "已上架模板"],
  ["changed", "未发布修改"],
  ["failed", "最近失败"],
  ["deleted", "已删除（只读历史）"],
];
const fields = [
  {
    key: "source",
    label: "来源",
    values: [
      ["", "全部来源"],
      ["workflow", "后台工作流"],
      ["template", "历史模板来源"],
    ],
  },
  {
    key: "api",
    label: "API 状态",
    values: [
      ["", "全部 API 状态"],
      ["published", "已开放"],
      ["disabled", "已停用"],
      ["unpublished", "未发布"],
      ["none", "无 API 渠道"],
    ],
  },
  {
    key: "template",
    label: "模板状态",
    values: [
      ["", "全部模板状态"],
      ["published", "已上架"],
      ["draft", "草稿"],
      ["archived", "已下架"],
      ["none", "无模板渠道"],
    ],
  },
];
const labels: Record<string, string> = {
  q: "搜索",
  kind: "类型",
  view: "快捷视图",
  source: "来源",
  id: "完整 ID",
  api: "API 状态",
  template: "模板状态",
  from: "更新开始",
  to: "更新结束",
};

/** 筛选始终反映 URL 的实际生效条件，高级条件可以逐项清除。 */
export function CenterFilters({
  query,
  params,
  onChange,
}: {
  query: CenterQuery;
  params: URLSearchParams;
  onChange: (values: Record<string, string | null>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const active = Object.keys(labels).filter((key) => params.get(key));
  return (
    <div className="mb-2 shrink-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="工作流类型" className="flex rounded-lg bg-muted p-0.5">
          {[
            ["", "全部"],
            ["media", "媒体创作"],
            ["general", "通用编排"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={(query.kind ?? "") === value}
              onClick={() => onChange({ kind: value, page: null })}
              className={`min-h-9 rounded-md px-3 text-[13px] ${query.kind === value ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative min-w-48 flex-1">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" aria-hidden />
          <input
            className="sol-admin-control w-full !pl-8"
            aria-label="搜索工作流"
            placeholder="搜索名称或用途"
            value={query.search ?? ""}
            onChange={(event) => onChange({ q: event.target.value, page: null })}
          />
        </label>
        <select
          className="sol-admin-control"
          aria-label="工作流快捷筛选"
          value={query.view ?? ""}
          onChange={(event) => onChange({ view: event.target.value || "", page: null })}
        >
          {quickViews.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          aria-expanded={expanded}
          onPress={() => setExpanded(!expanded)}
        >
          <SlidersHorizontal className="size-4" />
          筛选
        </Button>
      </div>
      {expanded && (
        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-3 lg:grid-cols-3">
          {fields.map((field) => (
            <label className="space-y-1 text-xs" key={field.key}>
              <span>{field.label}</span>
              <select
                className="sol-admin-control w-full"
                aria-label={field.label}
                value={params.get(field.key) ?? ""}
                onChange={(event) => onChange({ [field.key]: event.target.value, page: null })}
              >
                {field.values.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <IdFilter
            key={query.id ?? ""}
            value={query.id ?? ""}
            onApply={(id) => onChange({ id, page: null })}
          />
          {[
            ["from", "更新开始"],
            ["to", "更新结束"],
          ].map(([key, label]) => (
            <label className="space-y-1 text-xs" key={key}>
              <span>{label}（本地时间）</span>
              <input
                aria-label={label}
                className="sol-admin-control w-full"
                type="datetime-local"
                value={toLocal(params.get(key))}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value || Number.isFinite(Date.parse(value)))
                    onChange({ [key]: value ? new Date(value).toISOString() : null, page: null });
                }}
              />
            </label>
          ))}
        </div>
      )}
      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="已生效筛选">
          {active.map((key) => (
            <button
              key={key}
              className="inline-flex min-h-7 max-w-60 items-center gap-1 rounded bg-muted px-2 text-xs"
              onClick={() => onChange({ [key]: null, page: null })}
              aria-label={`清除${labels[key]}`}
            >
              <span className="truncate">
                {labels[key]}：{displayValue(key, params.get(key)!)}
              </span>
              <X className="size-3 shrink-0" />
            </button>
          ))}
          <button
            className="min-h-7 px-2 text-xs text-primary"
            onClick={() =>
              onChange(
                Object.fromEntries([...Object.keys(labels), "page"].map((key) => [key, null])),
              )
            }
          >
            清空筛选
          </button>
        </div>
      )}
    </div>
  );
}

function toLocal(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function displayValue(key: string, value: string) {
  return (
    (key === "view"
      ? quickViews
      : (fields.find((field) => field.key === key)?.values ?? [
          ["media", "媒体创作"],
          ["general", "通用编排"],
        ])
    ).find(([id]) => id === value)?.[1] ?? value
  );
}

function IdFilter({ value, onApply }: { value: string; onApply: (id: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState(false);
  function apply() {
    const id = draft.trim();
    if (
      id &&
      (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
        /^0+-0+-0+-0+-0+$/.test(id))
    ) {
      setError(true);
      return;
    }
    setError(false);
    if (id !== value) onApply(id);
  }
  return (
    <label className="space-y-1 text-sm">
      <span>完整 ID</span>
      <input
        aria-label="工作流完整 ID"
        aria-invalid={error}
        aria-describedby={error ? "workflow-id-error" : undefined}
        className="sol-admin-control w-full"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(false);
        }}
        onBlur={apply}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            apply();
          }
        }}
      />
      {error && (
        <span id="workflow-id-error" className="block text-destructive">
          请输入完整 UUID 后再筛选。
        </span>
      )}
    </label>
  );
}
