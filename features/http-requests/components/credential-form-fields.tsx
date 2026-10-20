"use client";
import { CredentialScopeFields } from "@/features/http-requests/components/credential-scope-fields";
import type { CredentialManagerController } from "@/features/http-requests/controllers/use-credential-manager";
import { button, control } from "@/features/http-requests/credential-form";
import { CredentialHeaderFields } from "./credential-header-fields";
export function CredentialFormFields({ controller }: { controller: CredentialManagerController }) {
  const { onSaved, id, detail, form, setForm, loading, busy, save, toggle } = controller;
  return (
    <fieldset disabled={busy || loading || (!!id && !detail)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          凭据名称
          <input
            aria-label="凭据名称"
            className={control}
            maxLength={100}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          目标站点
          <input
            aria-label="凭据目标站点"
            disabled={!!id}
            className={control}
            placeholder="https://api.example.com"
            value={form.origin}
            onChange={(event) => setForm({ ...form, origin: event.target.value })}
          />
        </label>
      </div>
      <CredentialScopeFields controller={controller} />
      <p className="text-xs leading-5 text-muted-foreground">
        这是权限边界，不是请求配置。只允许精确方法和路径，不允许整站通配。创建后只能轮换密钥；改变范围需新建凭据并重新授权。
      </p>
      {detail?.revisions.find((item) => item.id === detail.currentRevision)?.definition
        .requestDigest && (
        <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          此凭据由旧查询迁移，原参数映射和输出契约也已锁定。修改 HTTP
          节点契约将被拒绝；需要新调用方式时请创建并授权新凭据。
        </p>
      )}
      <label className="block space-y-1 text-sm">
        用途说明
        <input
          aria-label="凭据用途"
          className={control}
          maxLength={1000}
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
      </label>
      <CredentialHeaderFields controller={controller} />{" "}
      <p className="text-xs text-muted-foreground">
        没有认证头的凭据仍保留接口授权，不能移除凭据后匿名调用已迁移的受保护接口。
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className={`${button} bg-primary text-primary-foreground`}
          disabled={
            !form.name.trim() ||
            !form.origin.trim() ||
            !form.requests.length ||
            form.requests.some((scope) => !scope.url.trim())
          }
          onClick={() => void save()}
        >
          {busy ? "处理中…" : onSaved ? "保存版本并使用" : "保存新版本"}
        </button>
        {detail && (
          <button type="button" className={button} onClick={() => void toggle()}>
            {detail.enabled ? "停用凭据" : "启用凭据"}
          </button>
        )}
      </div>
    </fieldset>
  );
}
