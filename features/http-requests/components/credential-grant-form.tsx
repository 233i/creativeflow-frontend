"use client";
import type { CredentialAccessController } from "@/features/http-requests/controllers/use-credential-access";
import { opButton, opControl } from "@/features/http-requests/credential-access-styles";
export function CredentialGrantForm({ controller }: { controller: CredentialAccessController }) {
  const {
    data,
    kind,
    setKind,
    users,
    search,
    setSearch,
    subject,
    setSubject,
    setReason,
    setPending,
    busy,
    setRefresh,
  } = controller;
  return (
    <div className="space-y-3 rounded-2xl border p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">添加授权</h3>
        <button
          type="button"
          className={opButton}
          disabled={busy}
          onClick={() => setRefresh((value) => value + 1)}
        >
          刷新授权
        </button>
      </div>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          身份类型
          <select
            aria-label="凭据授权身份类型"
            className={opControl}
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as "account" | "apiKey");
              setSubject("");
            }}
          >
            <option value="account">用户账号</option>
            <option value="apiKey">API Key</option>
          </select>
        </label>
        {kind === "account" ? (
          <>
            <label className="space-y-1 text-sm">
              搜索账号
              <input
                aria-label="搜索凭据授权账号"
                className={opControl}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSubject("");
                }}
                placeholder="昵称或邮箱"
              />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              选择账号
              <select
                aria-label="选择凭据授权账号"
                className={opControl}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              >
                <option value="">选择已注册账号（最多 100 条）</option>
                {users
                  .filter((user) => user.isEnabled)
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName} · {user.email || user.id}
                    </option>
                  ))}
              </select>
            </label>
          </>
        ) : (
          <label className="space-y-1 text-sm">
            API Key 记录 ID
            <input
              aria-label="凭据授权 API Key ID"
              className={opControl}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="从 API 管理复制 Key 的记录 ID，勿填密钥"
            />
          </label>
        )}
      </fieldset>
      <button
        className={opButton}
        disabled={
          busy ||
          !subject ||
          data?.grants.some((grant) => grant.kind === kind && grant.id === subject && grant.enabled)
        }
        onClick={() => {
          setReason("");
          setPending({
            kind,
            id: subject,
            enabled: true,
            name:
              kind === "account"
                ? users.find((user) => user.id === subject)?.displayName || subject
                : subject,
          });
        }}
      >
        添加授权
      </button>
    </div>
  );
}
