import { auditLabels } from "@/features/assets/presentation";
import type { AssetDetail } from "@/features/assets/types";
export function AssetDetailAudit({ detail }: { detail: AssetDetail }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">最近 100 条操作；完整审计保留在数据库。</p>
      {detail.audit.length === 0 && <p>暂无管理操作。</p>}
      {detail.audit.map((a, i) => (
        <div key={i} className="border-l-2 pl-3">
          <p>
            {auditLabels[a.action] ?? a.action} · {new Date(a.createdAt).toLocaleString()}
          </p>
          <p className="mt-1">{a.reason}</p>
          <p className="break-all text-xs text-muted-foreground">操作人 {a.actor}</p>
        </div>
      ))}
    </div>
  );
}
