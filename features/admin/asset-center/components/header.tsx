"use client";
import { useRef } from "react";
import { RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssetPage } from "@/features/assets/types";
import type { AssetTab } from "../query-state";
export function AssetCenterHeader({
  page,
  tab,
  busy,
  onRefresh,
  upload,
}: {
  page: AssetPage | null;
  tab: AssetTab;
  busy: boolean;
  onRefresh: () => void;
  upload: (files: File[]) => Promise<void>;
}) {
  const uploadInput = useRef<HTMLInputElement>(null);
  return (
    <header className="sol-admin-panel-header">
      <div className="flex items-center gap-2">
        <h2>资产中心</h2>
        {page && tab !== "storage" && (
          <span className="rounded bg-muted px-2 py-1 text-xs">{page.total} 项</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="刷新资产"
          isDisabled={busy}
          onPress={() => {
            onRefresh();
          }}
        >
          <RefreshCw size={16} />
        </Button>
        <Button size="sm" isDisabled={busy} onPress={() => uploadInput.current?.click()}>
          <Upload size={16} />
          上传图片
        </Button>
      </div>
      <input
        ref={uploadInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        aria-label="上传资产图片"
        onChange={(e) => {
          void upload(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </header>
  );
}
