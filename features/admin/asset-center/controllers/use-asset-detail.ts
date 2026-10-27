"use client";

import { useEffect, useMemo, useState } from "react";
import { extractManagedFrame, getManagedAsset, updateManagedAsset } from "@/features/assets/api";
import { assetError, parseAssetTags } from "@/features/assets/commands";
import type { AssetDetail } from "@/features/assets/types";
import { useCommandLock } from "@/lib/hooks/use-command-lock";
import { useRequestScope } from "@/lib/hooks/use-request-scope";
import { useWorkspaceGuard } from "@/components/providers/workspace-context";

export function useAssetDetail(
  id: string,
  revision: number,
  onChanged: (message: string) => void,
  onSelect: (id: string) => void,
) {
  const [reload, setReload] = useState(0);
  const request = useMemo(() => ({ id, revision, reload }), [id, revision, reload]);
  const capture = useRequestScope(request);
  const lock = useCommandLock<"save" | "frame">(id);
  const [data, setData] = useState<{ request: typeof request; detail: AssetDetail } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [reason, setReason] = useState("");
  const detail = data?.request === request ? data.detail : null;
  useWorkspaceGuard({
    dirty:
      !!detail && (name !== detail.asset.name || tags !== detail.asset.tags.join(", ") || !!reason),
    busy: lock.pending !== null,
    save,
  });
  useEffect(() => {
    let disposed = false;
    const abort = new AbortController();
    void getManagedAsset(id, abort.signal)
      .then((value) => {
        if (disposed) return;
        setData({ request, detail: value });
        setName(value.asset.name);
        setTags(value.asset.tags.join(", "));
        setError("");
      })
      .catch((cause) => {
        if (!disposed) {
          setData(null);
          setError(assetError(cause, "读取失败。"));
        }
      });
    return () => {
      disposed = true;
      abort.abort();
    };
  }, [id, request]);
  async function copy(value: string) {
    const current = capture();
    try {
      await navigator.clipboard.writeText(value);
      if (current()) setNotice("已复制");
    } catch {
      if (current()) setError("复制失败，请手动选择文本复制。");
    }
  }
  async function save() {
    if (!detail || detail.asset.state !== "active" || !name.trim() || !reason.trim()) return false;
    const lease = lock.acquire("save");
    if (!lease) return false;
    const current = capture();
    setError("");
    try {
      await updateManagedAsset(id, {
        name: name.trim(),
        tags: parseAssetTags(tags),
        reason: reason.trim(),
        revision: detail.asset.revision,
      });
      if (current()) {
        setReason("");
        onChanged("资产信息已保存。");
        return true;
      }
      return false;
    } catch (cause) {
      if (current()) setError(assetError(cause, "保存未完成，请重新查询。"));
      return false;
    } finally {
      lease.release();
    }
  }
  async function frame() {
    if (!detail || detail.asset.state !== "active" || detail.asset.kind !== "video") return;
    const lease = lock.acquire("frame");
    if (!lease) return;
    const current = capture();
    setError("");
    try {
      const value = await extractManagedFrame(id);
      if (current()) {
        onChanged("尾帧已保存为派生图片，未调用模型。");
        onSelect(value.assetId);
      }
    } catch (cause) {
      if (current()) setError(assetError(cause, "提取失败。"));
    } finally {
      lease.release();
    }
  }
  function refresh() {
    setError("");
    setReload((value) => value + 1);
  }
  return {
    detail,
    name,
    setName,
    tags,
    setTags,
    reason,
    setReason,
    error,
    notice,
    busy: lock.pending !== null,
    refresh,
    previewKey: `${id}:${revision}:${reload}`,
    copy,
    save,
    frame,
  };
}
export type AssetDetailController = ReturnType<typeof useAssetDetail>;
