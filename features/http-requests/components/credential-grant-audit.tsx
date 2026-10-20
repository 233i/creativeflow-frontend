"use client";
import type { CredentialAccessController } from "@/features/http-requests/controllers/use-credential-access";
export function CredentialGrantAudit({ controller }: { controller: CredentialAccessController }) {
  const { data } = controller;
  return (
    <div className="space-y-3 rounded-2xl border p-5">
      <h3 className="font-semibold">最近调整记录</h3>
      <p className="text-xs text-muted-foreground">
        最近 100 条，保留原因；重复设置相同状态不重复记账。
      </p>
      {data?.audit.map((entry, index) => (
        <article key={index} className="border-t pt-3">
          <p className="text-xs text-muted-foreground">
            {new Date(entry.createdAt).toLocaleString()} · {entry.enabled ? "授权" : "撤权"}
          </p>
          <p className="break-all text-xs">
            {entry.kind} · {entry.id}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">{entry.reason}</p>
        </article>
      ))}
    </div>
  );
}
