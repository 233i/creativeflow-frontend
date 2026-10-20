"use client";

import { ImageIcon, Video, FileX } from "lucide-react";
import { useState } from "react";
import type { AssetItem } from "./api";

/** 列表只加载小图，失败保持明确占位，不自动加载几十份视频原件。 */
export function AssetThumbnail({
  asset,
  className = "",
  refresh = 0,
}: {
  asset: Pick<AssetItem, "name" | "kind" | "state" | "thumbnailUrl" | "duration">;
  className?: string;
  refresh?: number;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const removed = asset.state === "purged" || asset.state === "cleaning";
  const previewKey = `${asset.thumbnailUrl}:${refresh}`;
  const failed = failedUrl === previewKey;
  const Icon = removed ? FileX : asset.kind === "video" ? Video : ImageIcon;
  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-muted/40 ${className}`}
    >
      {removed || failed ? (
        <span className="flex flex-col items-center gap-1 text-muted-foreground">
          <Icon className="size-7" />
          <span className="text-[11px]">{removed ? "原件不可用" : "暂无预览"}</span>
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={previewKey}
          src={asset.thumbnailUrl}
          alt={asset.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
          onError={() => setFailedUrl(previewKey)}
        />
      )}
      {asset.kind === "video" && !removed && (
        <span className="absolute bottom-2 right-2 rounded bg-black/65 px-1.5 py-0.5 text-[11px] text-white">
          {asset.duration ? `${asset.duration.toFixed(1)} 秒` : "视频"}
        </span>
      )}
    </div>
  );
}
