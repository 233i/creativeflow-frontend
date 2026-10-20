"use client";

import { PrimaryTable, type PrimaryTableCol } from "tdesign-react";
import type { CenterItem } from "@/features/admin/workflow-center/api";
import type { WorkflowCenterController } from "../controllers/use-workflow-center";
import { CenterActionsContent } from "./center-actions-cell";
import { CenterChannelsContent } from "./center-channels-cell";
import { CenterRunContent } from "./center-run-cell";
import { CenterTitleContent } from "./center-title-cell";

const optionalColumns = new Set(["updatedAt", "source", "nodeCount"]);
const minimumColumnWidths: Record<string, number> = {
  name: 180,
  kind: 96,
  channels: 150,
  draft: 104,
  run: 128,
  updatedAt: 160,
  source: 108,
  nodeCount: 72,
  actions: 208,
};

function sortIndicator(sort: "name" | "updatedAt", current: string): string {
  if (sort === "name") {
    if (current === "name_asc") return "↑";
    if (current === "name_desc") return "↓";
    return "";
  }
  if (current === "updated_desc") return "↓";
  if (current === "updated_asc") return "↑";
  return "";
}

function nextSort(sort: "name" | "updatedAt", current: string): string {
  if (sort === "name") return current === "name_asc" ? "name_desc" : "name_asc";
  return current === "updated_desc" ? "updated_asc" : "updated_desc";
}

function SortButton({
  label,
  sort,
  current,
  onChange,
}: {
  label: string;
  sort: "name" | "updatedAt";
  current: string;
  onChange: (sort: string) => void;
}) {
  return (
    <button
      className="inline-flex min-h-8 items-center gap-1 text-left"
      aria-label={`按${label}排序`}
      onClick={() => onChange(nextSort(sort, current))}
    >
      {label} {sortIndicator(sort, current)}
    </button>
  );
}

function buildCenterColumns(
  controller: WorkflowCenterController,
): PrimaryTableCol<CenterItem>[] {
  const { query, update, widths, selectedColumns } = controller;
  const visible = (key: string) => !optionalColumns.has(key) || selectedColumns.has(key);
  const resize = (key: string) => ({
    minWidth: minimumColumnWidths[key] ?? 96,
    maxWidth: 640,
  });
  const onSort = (sort: string) => update({ sort, page: null });
  const columns: PrimaryTableCol<CenterItem>[] = [
    {
      colKey: "name",
      title: (
        <SortButton
          label="名称"
          sort="name"
          current={query.sort}
          onChange={onSort}
        />
      ),
      width: widths.name,
      resize: resize("name"),
      cell: ({ row }) => <CenterTitleContent controller={controller} item={row} />,
    },
    {
      colKey: "kind",
      title: "类型",
      width: widths.kind,
      resize: resize("kind"),
      cell: ({ row }) => (
        <span className="text-xs">{row.kind === "general" ? "通用编排" : "媒体创作"}</span>
      ),
    },
    {
      colKey: "channels",
      title: "发布渠道",
      width: widths.channels,
      resize: resize("channels"),
      cell: ({ row }) => <CenterChannelsContent controller={controller} item={row} />,
    },
    {
      colKey: "draft",
      title: "草稿",
      width: widths.draft,
      resize: resize("draft"),
      cell: ({ row }) => (
        <span
          className="sol-admin-status"
          data-tone={row.deletedAt || row.draftStatus === "saved" ? "default" : "warning"}
        >
          {row.deletedAt
            ? "已删除 · 只读"
            : { saved: "已保存", changed: "未发布修改", unpublished: "尚未发布" }[
                row.draftStatus
              ]}
        </span>
      ),
    },
    {
      colKey: "run",
      title: "最近运行",
      width: widths.run,
      resize: resize("run"),
      cell: ({ row }) => <CenterRunContent controller={controller} item={row} />,
    },
  ];

  if (visible("updatedAt"))
    columns.push({
      colKey: "updatedAt",
      title: (
        <SortButton
          label="更新时间"
          sort="updatedAt"
          current={query.sort}
          onChange={onSort}
        />
      ),
      width: widths.updatedAt,
      resize: resize("updatedAt"),
      cell: ({ row }) => (
        <time
          className="text-xs text-muted-foreground"
          dateTime={row.updatedAt}
          title={new Date(row.updatedAt).toLocaleString()}
        >
          {new Date(row.updatedAt).toLocaleString("zh-CN", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}
        </time>
      ),
    });
  if (visible("source"))
    columns.push({
      colKey: "source",
      title: "来源",
      width: widths.source,
      resize: resize("source"),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.source === "template" ? "历史模板来源" : "后台工作流"}
        </span>
      ),
    });
  if (visible("nodeCount"))
    columns.push({
      colKey: "nodeCount",
      title: "节点数",
      width: widths.nodeCount,
      resize: resize("nodeCount"),
      align: "right",
      cell: ({ row }) => row.nodeCount,
    });
  columns.push({
    colKey: "actions",
    title: "操作",
    width: widths.actions,
    resize: resize("actions"),
    fixed: "right",
    cell: ({ row }) => <CenterActionsContent controller={controller} item={row} />,
  });
  return columns;
}

function EmptyCenterState({
  controller,
  hasFilters,
}: {
  controller: WorkflowCenterController;
  hasFilters: boolean;
}) {
  const { query, capability, resetFilters, update, setCreating } = controller;
  return (
    <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-sm">
      <p>{hasFilters || query.offset > 0 ? "没有匹配的工作流" : "创建你的第一个工作流"}</p>
      <p className="text-xs text-muted-foreground">媒体创作与通用编排在这里统一管理。</p>
      {query.offset > 0 ? (
        <button className="sol-admin-row-action" onClick={() => update({ page: null })}>
          返回第一页
        </button>
      ) : hasFilters ? (
        <button className="sol-admin-row-action" onClick={resetFilters}>
          清空筛选
        </button>
      ) : (
        <button
          className="sol-admin-row-action"
          disabled={!capability?.create}
          onClick={() => setCreating(true)}
        >
          新建工作流
        </button>
      )}
    </div>
  );
}

/** 工作流中心使用可拖动列宽的 TDesign 表格，列显示仍由个人偏好控制。 */
export function CenterTable({ controller }: { controller: WorkflowCenterController }) {
  const {
    query,
    queryKey,
    loading,
    error,
    scrollRef,
    page,
    widths,
    setWidthPreference,
    density,
  } = controller;
  const columns = buildCenterColumns(controller);
  const hasFilters = Object.entries(query).some(
    ([key, value]) => !["sort", "offset", "limit"].includes(key) && value,
  );
  const empty = page?.items.length === 0 && !loading ? (
    <EmptyCenterState controller={controller} hasFilters={hasFilters} />
  ) : undefined;

  return (
    <div
      ref={scrollRef}
      className="sol-admin-table-region"
      onScroll={(event) => {
        try {
          sessionStorage.setItem(
            "creativeflow.admin.workflowScroll:" + queryKey,
            String(event.currentTarget.scrollTop),
          );
        } catch {
          /* 仅保存布局位置。 */
        }
      }}
    >
      <PrimaryTable
        className="sol-admin-workflow-table"
        rowKey="id"
        data={page?.items ?? []}
        columns={columns}
        loading={loading}
        hover
        bordered={false}
        disableDataPage
        tableLayout="fixed"
        size={density === "compact" ? "small" : "medium"}
        resizable
        onColumnResizeChange={({ columnsWidth }) =>
          setWidthPreference(JSON.stringify({ ...widths, ...columnsWidth }))
        }
        empty={empty}
      />
      {error && !page && <span className="sr-only">工作流读取失败</span>}
    </div>
  );
}
