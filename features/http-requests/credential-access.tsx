"use client";
import { CredentialGrantAudit } from "@/features/http-requests/components/credential-grant-audit";
import { CredentialGrantForm } from "@/features/http-requests/components/credential-grant-form";
import { CredentialGrants } from "@/features/http-requests/components/credential-grants";
import { useCredentialAccess } from "@/features/http-requests/controllers/use-credential-access";

import { opButton, opControl } from "./credential-access-styles";

/** 凭据授权与工作流 Key 权限分开；原因必填，修改必须确认，授权审计使用真实 API。 */
export function CredentialAccess({ id }: { id: string }) {
  const controller = useCredentialAccess({ id });
  const { reason, setReason, pending, setPending, busy, error, confirm } = controller;
  return (
    <section className="space-y-5">
      <p className="rounded-xl border bg-primary/5 p-4 text-sm leading-6">
        管理员可以调试。普通账号和 API Key
        必须各自获得凭据授权；仅有工作流调用权不等于凭据使用权。撤权阻止后续执行和旧结果查询，但无法撤回已下载内容。
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <CredentialGrantForm controller={controller} />
      {pending && (
        <div
          role="region"
          aria-label="确认凭据授权变更"
          className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-5"
        >
          <h3 className="font-semibold">
            {pending.enabled ? "确认授权" : "确认撤权"} · {pending.name}
          </h3>
          <p className="break-all text-xs text-muted-foreground">
            {pending.kind} · {pending.id}
          </p>
          <label className="block space-y-1 text-sm">
            调整原因
            <textarea
              aria-label="凭据授权调整原因"
              className={opControl}
              maxLength={300}
              rows={2}
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button className={opButton} disabled={busy} onClick={() => setPending(null)}>
              取消
            </button>
            <button
              className={`${opButton} bg-primary text-primary-foreground hover:bg-primary/90`}
              disabled={busy || !reason.trim()}
              onClick={() => void confirm()}
            >
              确认{pending.enabled ? "授权" : "撤权"}
            </button>
          </div>
        </div>
      )}
      <CredentialGrants controller={controller} />
      <CredentialGrantAudit controller={controller} />
    </section>
  );
}
