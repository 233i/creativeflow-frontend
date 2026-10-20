"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatBytes, stateLabel } from "@/features/assets/presentation";
import type { AssetItem } from "@/features/assets/types";
export function AssetDetailPreview({
  asset,
  previewKey,
  refresh,
}: {
  asset: AssetItem;
  previewKey: string;
  refresh: () => void;
}) {
  const [failedPreview, setFailedPreview] = useState<string | null>(null);
  return (
    <>
      {asset.state === "purged" || asset.state === "cleaning" ? (
        <p className="rounded-lg bg-muted p-6 text-center">
          {stateLabel(asset.state)} · 不提供原件
        </p>
      ) : failedPreview === previewKey ? (
        <div role="status" className="rounded-lg bg-muted p-6 text-center">
          <p>原件暂不可读取，请检查权限或存储状态。</p>
          <Button size="sm" variant="link" onPress={() => refresh()}>
            重新读取原件
          </Button>
        </div>
      ) : asset.kind === "video" ? (
        <video
          key={previewKey}
          controls
          preload="metadata"
          src={asset.url}
          onError={() => setFailedPreview(previewKey)}
          className="max-h-64 w-full rounded-lg bg-muted"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- protected asset content is not a public Next image source.
        <img
          key={previewKey}
          alt={asset.name}
          src={asset.url}
          onError={() => setFailedPreview(previewKey)}
          className="max-h-64 w-full rounded-lg bg-muted object-contain"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="sol-admin-status">{stateLabel(asset.state)}</span>
        <span>{formatBytes(asset.byteSize)}</span>
        <span className="text-muted-foreground">
          {asset.width && asset.height ? `${asset.width} × ${asset.height}` : asset.mediaType}
          {asset.duration ? ` · ${asset.duration.toFixed(1)} 秒` : ""}
        </span>
        {!["purged", "cleaning"].includes(asset.state) && (
          <a href={`${asset.url}?download=true`} className="ml-auto text-primary">
            下载原件
          </a>
        )}
      </div>
    </>
  );
}
