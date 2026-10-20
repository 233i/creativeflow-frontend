"use client";
import { Button } from "@/components/ui/button";
import type { WorkflowCenterController } from "../controllers/use-workflow-center";
export function CenterPagination({ controller }: { controller: WorkflowCenterController }) {
  const { update, query, loading, page, currentPage } = controller;
  return (
    <footer className="sol-admin-pagination">
      <span>
        {page ? `共 ${page.total} 条` : "总数待查询"}
        {loading && page && " · 更新中"}
      </span>
      <div className="flex items-center gap-2">
        <select
          aria-label="每页条数"
          className="sol-admin-control"
          value={query.limit}
          onChange={(event) => update({ size: event.target.value, page: null })}
        >
          <option value="20">20 条 / 页</option>
          <option value="50">50 条 / 页</option>
        </select>
        <Button
          size="sm"
          variant="outline"
          isDisabled={currentPage <= 1 || loading}
          onPress={() => update({ page: String(currentPage - 1) })}
        >
          上一页
        </Button>
        <span>
          {currentPage} / {page ? Math.max(1, Math.ceil(page.total / query.limit)) : "—"}
        </span>
        <Button
          size="sm"
          variant="outline"
          isDisabled={!page || query.offset + query.limit >= page.total || loading}
          onPress={() => update({ page: String(currentPage + 1) })}
        >
          下一页
        </Button>
      </div>
    </footer>
  );
}
