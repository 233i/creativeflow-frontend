"use client";
import { Button } from "@/components/ui/button";
import type { AssetSelection } from "@/features/assets/selection";
import type { AssetBatchKind, AssetPage } from "@/features/assets/types";
import { Download } from "lucide-react";
import type { AssetTab } from "../query-state";
export function AssetSelectionToolbar({
  page,
  loading,
  selection,
  busy,
  tab,
  download,
  onBatch,
}: {
  page: AssetPage | null;
  loading: boolean;
  selection: AssetSelection;
  busy: boolean;
  tab: AssetTab;
  download: () => Promise<void>;
  onBatch: (action: AssetBatchKind) => void;
}) {
  const { selected, selectedIds } = selection;
  return (
    <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2 text-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          aria-label="选择本页资产"
          disabled={!page?.items.length || loading}
          checked={!!page?.items.length && page.items.every((x) => selectedIds.has(x.id))}
          onChange={(e) => selection.selectPage(e.target.checked)}
        />
        选择本页
      </label>
      <span className="text-xs text-muted-foreground">已选 {selected.length}/50</span>
      {selected.length > 0 && (
        <>
          <Button size="xs" variant="outline" isDisabled={busy} onPress={() => void download()}>
            <Download size={14} />
            打包下载
          </Button>
          {tab === "recycle" ? (
            <>
              <Button
                size="xs"
                variant="outline"
                isDisabled={busy}
                onPress={() => onBatch("restore")}
              >
                批量恢复
              </Button>
              <Button
                size="xs"
                variant="outline"
                isDisabled={busy}
                onPress={() => onBatch("purge")}
              >
                安全清理
              </Button>
            </>
          ) : (
            <>
              <Button
                size="xs"
                variant="outline"
                isDisabled={busy}
                onPress={() => onBatch("group")}
              >
                移动文件夹
              </Button>
              <Button size="xs" variant="outline" isDisabled={busy} onPress={() => onBatch("tags")}>
                添加标签
              </Button>
              <Button
                size="xs"
                variant="outline"
                isDisabled={busy}
                onPress={() => onBatch("recycle")}
              >
                移入回收站
              </Button>
            </>
          )}
          <button className="text-xs text-muted-foreground" onClick={() => selection.clear()}>
            取消选择
          </button>
        </>
      )}
    </div>
  );
}
