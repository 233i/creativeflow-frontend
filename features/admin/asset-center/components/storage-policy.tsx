"use client";
import { Button } from "@/components/ui/button";
import type { AssetStorageController } from "../controllers/use-asset-storage";
export function AssetStoragePolicy({ controller }: { controller: AssetStorageController }) {
  const { days, setDays, warning, setWarning, account, setAccount, valid, busy, save } = controller;
  return (
    <section className="rounded-xl border p-4">
      <h3 className="mb-3 font-medium">保留与告警策略</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm">
          回收站保留天数
          <input
            aria-label="回收站保留天数"
            className="sol-admin-control"
            type="number"
            min={0}
            max={365}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </label>
        <label className="grid gap-1 text-sm">
          总存储告警（GiB，0 关闭）
          <input
            aria-label="总存储告警"
            className="sol-admin-control"
            type="number"
            min={0}
            step="0.1"
            value={warning}
            onChange={(e) => setWarning(Number(e.target.value))}
          />
        </label>
        <label className="grid gap-1 text-sm">
          用户用量告警（GiB，0 关闭）
          <input
            aria-label="用户用量告警"
            className="sol-admin-control"
            type="number"
            min={0}
            step="0.1"
            value={account}
            onChange={(e) => setAccount(Number(e.target.value))}
          />
        </label>
      </div>
      <Button className="mt-3" size="sm" isDisabled={busy || !valid} onPress={() => void save()}>
        保存策略
      </Button>
    </section>
  );
}
