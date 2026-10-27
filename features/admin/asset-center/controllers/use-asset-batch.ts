"use client";

import { useState } from "react";
import { batchAssets } from "@/features/assets/api";
import { assetBatchRequest, assetError } from "@/features/assets/commands";
import type { AssetItem, AssetBatchKind, AssetResult } from "@/features/assets/types";
import { useCommandLock } from "@/lib/hooks/use-command-lock";
import { useWorkspaceGuard } from "@/components/providers/workspace-context";

export function useAssetBatch(
  assets: AssetItem[],
  action: AssetBatchKind,
  onDone: (results: AssetResult[]) => void,
) {
  const [reason, setReason] = useState("");
  const [value, setValue] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const lock = useCommandLock<"batch">(
    JSON.stringify([action, assets.map((asset) => [asset.id, asset.revision])]),
  );
  useWorkspaceGuard({
    dirty: !!reason || !!value || confirmed,
    busy: lock.pending !== null,
    message: "资产批量操作尚未确认，关闭将放弃输入。",
  });
  async function submit() {
    if (!assets.length || !confirmed || !reason.trim() || error) return;
    const lease = lock.acquire("batch");
    if (!lease) return;
    setError("");
    try {
      const results = await batchAssets(assetBatchRequest(action, assets, reason, value));
      if (lease.current()) onDone(results);
    } catch (cause) {
      if (lease.current())
        setError(`${assetError(cause, "批量结果不明确。")} 请关闭后刷新列表确认，不会自动重试。`);
    } finally {
      lease.release();
    }
  }
  return {
    reason,
    setReason,
    value,
    setValue,
    confirmed,
    setConfirmed,
    error,
    busy: lock.pending !== null,
    submit,
  };
}
