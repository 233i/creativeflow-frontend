"use client";
import { Button } from "@/components/ui/button";
import type { AssetPage, AssetQuery } from "@/features/assets/types";
export function AssetPagination({
  page,
  loading,
  pageNumber,
  query,
  setPage,
}: {
  page: AssetPage | null;
  loading: boolean;
  pageNumber: number;
  query: AssetQuery;
  setPage: (page: number) => void;
}) {
  return (
    <footer className="mt-3 flex shrink-0 items-center justify-between text-sm">
      <span>
        第 {pageNumber} / {Math.max(1, Math.ceil((page?.total ?? 0) / 30))} 页 · 每页 30 项
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          isDisabled={pageNumber <= 1 || loading}
          onPress={() => {
            setPage(pageNumber - 1);
          }}
        >
          上一页
        </Button>
        <Button
          size="sm"
          variant="outline"
          isDisabled={loading || !page || query.offset! + page.items.length >= page.total}
          onPress={() => {
            setPage(pageNumber + 1);
          }}
        >
          下一页
        </Button>
      </div>
    </footer>
  );
}
