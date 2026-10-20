"use client";

import { Library, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { AssetLibraryDialog } from "@/features/canvas/asset-library-dialog";
import { useWorkflowEditorEnvironment } from "@/features/workflow/editor-environment";

export interface ImageAssetValue {
  assetId: string;
}

/** 通用编排图片字段的上传/素材库入口；持久化只写 assetId，不把 blob/data URL 写进工作流。 */
export function ImageValuePicker({
  value,
  onChange,
  label,
  className = "",
}: {
  value?: ImageAssetValue | null;
  onChange: (value: ImageAssetValue | null) => void;
  label: string;
  className?: string;
}) {
  const { uploadAsset, assetUrl, assets } = useWorkflowEditorEnvironment();
  const input = useRef<HTMLInputElement | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadAsset(file);
      onChange({ assetId: uploaded.assetId });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "图片上传失败");
    } finally {
      setBusy(false);
    }
  }

  const url = value?.assetId ? assetUrl(`/api/v1/canvas/assets/${value.assetId}`) : null;
  return (
    <div className={`space-y-2 ${className}`}>
      {url ? (
        <div className="relative overflow-hidden rounded-lg border bg-muted/20">
          <Image
            unoptimized
            src={url}
            alt={label}
            width={320}
            height={112}
            className="h-28 w-full object-contain"
          />
          <button
            type="button"
            aria-label={`${label} 移除`}
            className="absolute right-1 top-1 rounded-md bg-background/90 p-1 text-destructive shadow"
            onClick={() => onChange(null)}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
          未选择图片
        </div>
      )}
      <div className="flex gap-2">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
        <button
          type="button"
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Upload className="size-3.5" />
          本地上传
        </button>
        <button
          type="button"
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
          disabled={busy}
          onClick={() => setLibraryOpen(true)}
        >
          <Library className="size-3.5" />
          从素材库选择
        </button>
      </div>
      {busy && <p className="text-[11px] text-muted-foreground">上传中…</p>}
      {error && (
        <p role="alert" className="text-[11px] text-destructive">
          {error}
        </p>
      )}
      {libraryOpen && (
        <AssetLibraryDialog
          mode="select"
          source={
            assets
              ? {
                  listAssets: assets.listAssets,
                  listAssetPage: assets.listAssetPage,
                  reusePublicAsset: assets.reusePublicAsset,
                  listAssetGroups: assets.listAssetGroups,
                  assetUrl: assets.assetUrl,
                }
              : undefined
          }
          selectedAssetUrl={value?.assetId ? `/api/v1/canvas/assets/${value.assetId}` : undefined}
          onSelect={(asset) => {
            onChange({ assetId: asset.id });
            setLibraryOpen(false);
          }}
          onOpenChange={setLibraryOpen}
        />
      )}
    </div>
  );
}

export function parseImageValue(value: unknown): ImageAssetValue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const assetId = (value as { assetId?: unknown }).assetId;
  return typeof assetId === "string" && assetId.length > 0 ? { assetId } : null;
}
