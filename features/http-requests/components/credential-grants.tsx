"use client";
import type { CredentialAccessController } from "@/features/http-requests/controllers/use-credential-access";
import { opButton } from "@/features/http-requests/credential-access-styles";
export function CredentialGrants({ controller }: { controller: CredentialAccessController }) {
  const { data, setReason, setPending, busy } = controller;
  return (
    <div className="space-y-3 rounded-2xl border p-5">
      <h3 className="font-semibold">已配置的权限</h3>
      {data?.grants.length === 0 && (
        <p className="text-sm text-muted-foreground">暂无普通账号或 API Key 授权。</p>
      )}
      {data?.grants.map((grant) => (
        <div
          key={`${grant.kind}:${grant.id}`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
        >
          <div className="min-w-0">
            <strong className="text-sm">{grant.name}</strong>
            <p className="break-all text-xs text-muted-foreground">
              {grant.kind} · {grant.id}
            </p>
          </div>
          <span
            className={`text-xs ${grant.enabled ? "text-emerald-700" : "text-muted-foreground"}`}
          >
            {grant.enabled ? "已授权" : "已撤权"}
          </span>
          <button
            className={opButton}
            disabled={busy}
            onClick={() => {
              setReason("");
              setPending({ ...grant, enabled: !grant.enabled });
            }}
          >
            {grant.enabled ? "撤销授权" : "重新授权"}
          </button>
        </div>
      ))}
    </div>
  );
}
