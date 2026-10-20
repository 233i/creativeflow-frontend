"use client";

import { useEffect, useMemo, useState } from "react";
import { assetStorage, setAssetPolicy } from "@/features/assets/api";
import { assetError } from "@/features/assets/commands";
import type { AssetStorage } from "@/features/assets/types";
import { useCommandLock } from "@/lib/hooks/use-command-lock";
import { useRequestScope } from "@/lib/hooks/use-request-scope";

export function useAssetStorage(refresh: number) {
  const [data, setData] = useState<AssetStorage | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [days, setDays] = useState(7);
  const [warning, setWarning] = useState(10);
  const [account, setAccount] = useState(2);
  const scope = useMemo(() => ({ refresh, reload }), [refresh, reload]);
  const capture = useRequestScope(scope);
  const lock = useCommandLock<"save">("asset-storage");
  useEffect(() => {
    let disposed = false;
    const abort = new AbortController();
    void assetStorage(abort.signal)
      .then((value) => {
        if (disposed) return;
        setData(value);
        setDays(value.policy.retentionDays);
        setWarning(value.policy.warningBytes / 1073741824);
        setAccount(value.policy.accountWarningBytes / 1073741824);
        setError("");
      })
      .catch((reason) => {
        if (!disposed) {
          setData(null);
          setError(assetError(reason, "统计读取失败。"));
        }
      });
    return () => {
      disposed = true;
      abort.abort();
    };
  }, [scope]);
  const valid =
    Number.isInteger(days) &&
    days >= 0 &&
    days <= 365 &&
    warning >= 0 &&
    account >= 0 &&
    Number.isFinite(warning + account);
  async function save() {
    if (!valid) return;
    const lease = lock.acquire("save");
    if (!lease) return;
    const current = capture();
    setError("");
    try {
      await setAssetPolicy({
        retentionDays: days,
        warningBytes: Math.round(warning * 1073741824),
        accountWarningBytes: Math.round(account * 1073741824),
      });
      if (current()) {
        setNotice("策略已保存；不会自动删除任何资产。");
        setReload((value) => value + 1);
      }
    } catch (reason) {
      if (current()) setError(assetError(reason, "设置未保存。"));
    } finally {
      lease.release();
    }
  }
  return {
    data,
    error,
    notice,
    days,
    setDays,
    warning,
    setWarning,
    account,
    setAccount,
    valid,
    busy: lock.pending !== null,
    save,
    retry: () => setReload((value) => value + 1),
  };
}
export type AssetStorageController = ReturnType<typeof useAssetStorage>;
