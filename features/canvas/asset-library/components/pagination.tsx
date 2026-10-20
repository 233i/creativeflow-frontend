"use client";

import { Button } from "@/components/ui/button";
import type { LibraryController } from "../controllers/use-library-controller";

export function LibraryPagination({ controller }: { controller: LibraryController }) {
  const { filters, query, commands } = controller;
  return (
    <div className="flex items-center justify-between text-xs">
      <span>
        第 {filters.page + 1} / {Math.max(1, Math.ceil(query.total / 24))} 页
      </span>
      <div className="flex gap-2">
        <Button
          size="xs"
          variant="outline"
          isDisabled={query.loading || !!commands.busy || filters.page === 0}
          onPress={() => filters.setPage(filters.page - 1)}
        >
          上一页
        </Button>
        <Button
          size="xs"
          variant="outline"
          isDisabled={query.loading || !!commands.busy || (filters.page + 1) * 24 >= query.total}
          onPress={() => filters.setPage(filters.page + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
