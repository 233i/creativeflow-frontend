"use client";
import { Button } from "@/components/ui/button";
import { formatBytes, sourceLabel } from "@/features/assets/presentation";
import type { AssetStorage } from "@/features/assets/types";
export function AssetStorageSummary({
  data,
  onClean,
}: {
  data: AssetStorage;
  onClean: () => void;
}) {
  return (
    <>
      {data.warning && (
        <p
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          资产总量或用户逻辑用量已达到告警阈值，请检查大文件与回收站。
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "有效资产（逻辑）", bytes: data.activeBytes },
          { label: "回收站（逻辑）", bytes: data.recycleBytes },
          { label: "已登记文件与预览（去重）", bytes: data.storedBytes },
          { label: "可安全清理（逻辑）", bytes: data.purgeableBytes },
        ].map(({ label, bytes }) => (
          <div key={label} className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatBytes(bytes)}</p>
          </div>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        图片、视频和预览保存在独立文件卷，数据库只保存元数据。逻辑容量按资产计数，共享文件只存一份；已登记文件容量不含临时写入、Skill
        包、备份或磁盘预留空间。新文件有 1 小时保护期，无引用且无恢复任务的文件才会由后台回收。
      </p>
      <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
        <div>
          <h3 className="font-medium">安全清理候选</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            仅回收期限已满、没有任何引用的资产；清理前逐项复核，不自动删除。
          </p>
        </div>
        <Button variant="outline" size="sm" onPress={onClean}>
          查看候选
        </Button>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {[
          { title: "按类型", buckets: data.byKind },
          { title: "按来源", buckets: data.bySource },
          { title: "按所有者", buckets: data.byOwner },
        ].map(({ title, buckets }) => (
          <section key={title} className="rounded-xl border p-4">
            <h3 className="mb-3 font-medium">{title}</h3>
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {buckets.map((b) => (
                <div key={b.key}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate" title={b.key}>
                      {b.key === "image" ? "图片" : b.key === "video" ? "视频" : sourceLabel(b.key)}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatBytes(b.bytes)} · {b.count} 项
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded bg-muted">
                    <div
                      className="h-1 rounded bg-primary/60"
                      style={{
                        width: `${Math.min(100, (b.bytes / Math.max(1, data.activeBytes + data.recycleBytes)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
