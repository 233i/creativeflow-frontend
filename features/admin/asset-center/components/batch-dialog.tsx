"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBytes, batchNames } from "@/features/assets/presentation";
import type { AssetItem, AssetBatchKind, AssetResult } from "@/features/assets/types";
import { useAssetBatch } from "../controllers/use-asset-batch";
export function AssetBatchDialog({
  assets,
  action,
  onClose,
  onDone,
}: {
  assets: AssetItem[];
  action: AssetBatchKind;
  onClose: () => void;
  onDone: (results: AssetResult[]) => void;
}) {
  const { reason, setReason, value, setValue, confirmed, setConfirmed, busy, error, submit } =
    useAssetBatch(assets, action, onDone);
  const label = batchNames[action];
  return (
    <Dialog
      isOpen
      aria-label={label}
      isDismissable={!busy}
      showCloseButton={!busy}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogHeader>
        <DialogTitle>{label}</DialogTitle>
        <DialogDescription>
          仅处理明确选择的 {assets.length} 个资产，逐项检查并返回结果。
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <ul className="max-h-28 overflow-y-auto text-xs text-muted-foreground">
          {assets.map((a) => (
            <li key={a.id}>
              {a.name} · {a.referenceCount} 处引用 · {formatBytes(a.byteSize)}
            </li>
          ))}
        </ul>
        {action === "purge" && (
          <p className="rounded bg-destructive/5 p-3">
            不可恢复。只有保留期已满且无任何引用的资产才会清理；历史成品不会批量放弃。
          </p>
        )}
        {action === "recycle" && (
          <p>有运行中任务或已发布为公共素材的项目会被阻止；其他项目移入回收站后不能用于新运行。</p>
        )}
        {(action === "group" || action === "tags") && (
          <label className="grid gap-1">
            {action === "group"
              ? "文件夹名称（留空移出；不同所有者各自归档）"
              : "新标签（逗号分隔，不覆盖已有标签）"}
            <input
              aria-label={action === "group" ? "目标文件夹" : "批量标签"}
              className="sol-admin-control"
              maxLength={action === "group" ? 64 : 820}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
        )}
        <label className="grid gap-1">
          操作原因
          <textarea
            aria-label="批量操作原因"
            className="sol-admin-control min-h-20"
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          我已核对所选 {assets.length} 项及操作影响
        </label>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" isDisabled={busy} onPress={onClose}>
          关闭
        </Button>
        <Button
          isDisabled={busy || !reason.trim() || !confirmed || !!error}
          onPress={() => void submit()}
        >
          {busy ? "逐项处理中…" : "确认执行"}
        </Button>
      </div>
    </Dialog>
  );
}
