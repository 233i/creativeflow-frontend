"use client";
import { Button } from "@/components/ui/button";
import { sourceLabel } from "@/features/assets/presentation";
import type { AssetDetail } from "@/features/assets/types";
import type { AssetDetailController } from "../controllers/use-asset-detail";
export function AssetDetailInfo({
  detail,
  controller,
}: {
  detail: AssetDetail;
  controller: AssetDetailController;
}) {
  const asset = detail.asset;
  const id = asset.id;
  const { name, setName, tags, setTags, reason, setReason, busy, save, frame, copy } = controller;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all text-xs">{id}</code>
        <Button size="xs" variant="outline" onPress={() => void copy(id)}>
          复制 ID
        </Button>
      </div>
      <dl className="grid grid-cols-[5rem_1fr] gap-2">
        <dt className="text-muted-foreground">所有者</dt>
        <dd>{asset.owner}</dd>
        <dt className="text-muted-foreground">来源</dt>
        <dd>{sourceLabel(asset.source)}</dd>
        <dt className="text-muted-foreground">文件夹</dt>
        <dd>{asset.groupName ?? "未分组"}</dd>
        <dt className="text-muted-foreground">创建时间</dt>
        <dd>{new Date(asset.createdAt).toLocaleString()}</dd>
      </dl>
      <label className="grid gap-1">
        名称
        <input
          className="sol-admin-control w-full"
          aria-label="资产名称"
          value={name}
          maxLength={200}
          disabled={busy || asset.state !== "active"}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="grid gap-1">
        标签（逗号分隔，最多 20 个）
        <input
          className="sol-admin-control w-full"
          aria-label="资产标签"
          value={tags}
          disabled={busy || asset.state !== "active"}
          onChange={(e) => setTags(e.target.value)}
        />
      </label>
      {asset.state === "active" && (
        <>
          <label className="grid gap-1">
            修改原因
            <input
              aria-label="修改原因"
              disabled={busy}
              className="sol-admin-control w-full"
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <Button
            size="sm"
            isDisabled={busy || !name.trim() || !reason.trim()}
            onPress={() => void save()}
          >
            保存资料
          </Button>
          {asset.kind === "video" && (
            <Button
              className="ml-2"
              size="sm"
              variant="outline"
              isDisabled={busy}
              onPress={() => void frame()}
            >
              提取尾帧
            </Button>
          )}
        </>
      )}
      {detail.sha256 && (
        <details className="text-xs text-muted-foreground">
          <summary>文件校验摘要</summary>
          <code className="break-all">{detail.sha256}</code>
        </details>
      )}
    </div>
  );
}
