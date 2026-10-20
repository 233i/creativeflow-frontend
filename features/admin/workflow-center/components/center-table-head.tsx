"use client";
import type { WorkflowCenterController } from "../controllers/use-workflow-center";
export function CenterTableHead({ controller }: { controller: WorkflowCenterController }) {
  const { update, query, selectedColumns } = controller;
  return (
    <thead>
      <tr>
        <th
          aria-sort={
            query.sort === "name_asc"
              ? "ascending"
              : query.sort === "name_desc"
                ? "descending"
                : "none"
          }
        >
          <button
            onClick={() =>
              update({
                sort: query.sort === "name_asc" ? "name_desc" : "name_asc",
                page: null,
              })
            }
          >
            名称 {query.sort === "name_asc" ? "↑" : query.sort === "name_desc" ? "↓" : ""}
          </button>
        </th>
        <th>类型</th>
        <th>发布渠道</th>
        <th>草稿</th>
        <th>最近运行</th>
        {selectedColumns.has("updatedAt") && (
          <th
            aria-sort={
              query.sort === "updated_desc"
                ? "descending"
                : query.sort === "updated_asc"
                  ? "ascending"
                  : "none"
            }
          >
            <button
              onClick={() =>
                update({
                  sort: query.sort === "updated_desc" ? "updated_asc" : "updated_desc",
                  page: null,
                })
              }
            >
              更新时间{" "}
              {query.sort === "updated_desc" ? "↓" : query.sort === "updated_asc" ? "↑" : ""}
            </button>
          </th>
        )}
        {selectedColumns.has("source") && <th>来源</th>}
        {selectedColumns.has("nodeCount") && <th>节点数</th>}
        <th>操作</th>
      </tr>
    </thead>
  );
}
