"use client";
import type { AssetActionKind } from "@/features/assets/types";
import type { AssetActionController } from "../controllers/use-asset-action";
export function AssetActionFields({
  action,
  controller,
}: {
  action: AssetActionKind;
  controller: AssetActionController;
}) {
  const { preview, history, setHistory, confirmName, name, setName, reason, setReason } =
    controller;
  if (!preview) return null;
  return (
    <>
      {action === "purge" && preview.canPurgeHistory && !preview.canPurge && (
        <label className="flex gap-2 rounded-lg border border-destructive/30 p-3 text-destructive">
          <input type="checkbox" checked={history} onChange={(e) => setHistory(e.target.checked)} />
          <span>
            我确认放弃历史任务的此份原件，历史记录将只能查看元数据，不能再读取该资产或用于重跑。
          </span>
        </label>
      )}
      {confirmName && (
        <label className="grid gap-1">
          输入完整资产名称确认
          <input
            className="sol-admin-control w-full"
            aria-label="确认资产名称"
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      )}
      <label className="grid gap-1">
        操作原因 <span className="sr-only">必填</span>
        <textarea
          className="sol-admin-control min-h-20 w-full"
          aria-label="操作原因"
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
    </>
  );
}
