"use client";

import { useEffect, useState } from "react";
import { manageAsset, previewAssetDeletion } from "@/features/assets/api";
import { assetActionAllowed, assetError } from "@/features/assets/commands";
import type { AssetActionKind, AssetDeletionPreview, AssetItem } from "@/features/assets/types";
import { useCommandLock } from "@/lib/hooks/use-command-lock";
import { useWorkspaceGuard } from "@/components/providers/workspace-context";

export function useAssetAction(
  asset: AssetItem,
  action: AssetActionKind,
  onDone: (message: string) => void,
) {
  const [preview, setPreview] = useState<AssetDeletionPreview | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [history, setHistory] = useState(false);
  const lock = useCommandLock<"submit">(`${asset.id}:${action}`);
  useWorkspaceGuard({
    dirty: !!reason || !!name || history,
    busy: lock.pending !== null,
    message: "资产操作尚未确认，关闭将放弃输入；不会自动执行资产操作。",
  });
  useEffect(() => {
    let disposed = false;
    const abort = new AbortController();
    void previewAssetDeletion(asset.id, abort.signal).then(
      (value) => {
        if (!disposed) setPreview(value);
      },
      (cause) => {
        if (!disposed) setError(assetError(cause, "引用检查失败。"));
      },
    );
    return () => {
      disposed = true;
      abort.abort();
    };
  }, [asset.id, reload]);
  const allowed = assetActionAllowed(action, preview, history);
  const confirmName = action === "purge" || action === "publish";
  const ready = allowed && !!reason.trim() && (!confirmName || name === preview?.asset.name);
  async function submit() {
    if (!preview || !ready) return;
    const lease = lock.acquire("submit");
    if (!lease) return;
    setError("");
    try {
      const result = await manageAsset(asset.id, action, {
        revision: preview.asset.revision,
        reason: reason.trim(),
        confirmName: name,
        allowHistory: history,
      });
      if (lease.current()) onDone(result.message);
    } catch (cause) {
      if (lease.current()) {
        setPreview(null);
        setName("");
        setHistory(false);
        setError(`${assetError(cause, "操作结果不明确。")} 请重新查询状态，不会自动重试。`);
      }
    } finally {
      lease.release();
    }
  }
  function refresh() {
    setPreview(null);
    setError("");
    setReload((value) => value + 1);
  }
  return {
    preview,
    error,
    reason,
    setReason,
    name,
    setName,
    history,
    setHistory,
    confirmName,
    ready,
    busy: lock.pending !== null,
    submit,
    refresh,
  };
}
export type AssetActionController = ReturnType<typeof useAssetAction>;
