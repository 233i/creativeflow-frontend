"use client";

import { useState } from "react";
import { downloadAssets, uploadManagedAsset } from "@/features/assets/api";
import { assetError } from "@/features/assets/commands";
import type { AssetItem } from "@/features/assets/types";
import { useCommandLock } from "@/lib/hooks/use-command-lock";

export function useCenterCommands(onChanged: (message: string) => void) {
  const lock = useCommandLock<"upload" | "download">("asset-center");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState("");
  async function upload(files: File[]) {
    if (!files.length) return;
    if (files.length > 50) {
      setError("一次最多上传 50 张图片。");
      return;
    }
    const lease = lock.acquire("upload");
    if (!lease) return;
    setError("");
    const failures: string[] = [];
    let succeeded = 0;
    try {
      for (const [index, file] of files.entries()) {
        if (!lease.current()) return;
        setProgress(`上传 ${index + 1}/${files.length} · ${file.name}`);
        try {
          await uploadManagedAsset(file);
          succeeded++;
        } catch (reason) {
          failures.push(`${file.name}：${assetError(reason, "未完成")}`);
        }
      }
      if (lease.current()) {
        setError(failures.join("；"));
        onChanged(
          `已上传 ${succeeded}/${files.length} 张图片。默认私有，可在详情中显式发布公共素材。`,
        );
      }
    } finally {
      if (lease.current()) setProgress("");
      lease.release();
    }
  }
  async function download(assets: AssetItem[]) {
    if (!assets.length) return;
    const lease = lock.acquire("download");
    if (!lease) return;
    setError("");
    try {
      await downloadAssets(assets.map((asset) => asset.id));
      if (lease.current()) setNotice("打包完成，已开始下载。");
    } catch (reason) {
      if (lease.current()) setError(assetError(reason, "打包未完成。"));
    } finally {
      lease.release();
    }
  }
  return {
    busy: lock.pending !== null,
    error,
    notice,
    progress,
    upload,
    download,
    setNotice,
    clearError: () => setError(""),
  };
}
