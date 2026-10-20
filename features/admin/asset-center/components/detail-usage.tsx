"use client";
import Link from "next/link";
import type { AssetDetail } from "@/features/assets/types";
export function AssetDetailReferences({ detail }: { detail: AssetDetail }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        检查包含画布、草稿、发布版本、模板、任务及历史结果。永久清理再次检查全部引用。
      </p>
      {detail.references.length === 0 && <p>未发现引用。</p>}
      {detail.references.map((r, i) => (
        <div key={i} className="rounded-lg border p-3">
          <p>{r.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {r.kind} ·{" "}
            {r.protection === "active"
              ? "排队 / 运行中"
              : r.protection === "protected"
                ? "受保护引用"
                : "历史引用"}
          </p>
          {r.workflowId && (
            <Link
              className="mt-1 inline-block text-primary"
              href={`/admin/workflows/${r.workflowId}/${r.runId ? "runs?inspectRun=" + r.runId : "edit"}`}
            >
              查看位置
            </Link>
          )}
          <details className="mt-1 text-xs text-muted-foreground">
            <summary>记录 ID</summary>
            <code className="break-all">
              {r.id}
              {r.slot ? ` · ${r.slot}` : ""}
            </code>
          </details>
        </div>
      ))}
    </div>
  );
}
