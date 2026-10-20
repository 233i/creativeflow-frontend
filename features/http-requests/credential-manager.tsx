"use client";
import { CredentialFormFields } from "@/features/http-requests/components/credential-form-fields";
import { CredentialRevisions } from "@/features/http-requests/components/credential-revisions";
import { useCredentialManager } from "@/features/http-requests/controllers/use-credential-manager";

import { button, control, empty } from "./credential-form";

import { CredentialAccess } from "./credential-access";

/** 凭据在独立对话框中管理，秘密表单从不写入工作流节点状态。 */
export function CredentialManager({
  onClose,
  onSaved,
  initialId = "",
  initialScope,
}: {
  onClose: () => void;
  onSaved?: (id: string, revision: string) => void;
  initialId?: string;
  initialScope?: { method: string; url: string };
}) {
  const controller = useCredentialManager({ onClose, onSaved, initialId, initialScope });
  const {
    dialogRef,
    lockRef,
    list,
    id,
    setId,
    detail,
    setDetail,
    setForm,
    setRefresh,
    loading,
    setLoading,
    busy,
    error,
    setError,
    message,
    setMessage,
  } = controller;
  return (
    <dialog
      ref={dialogRef}
      aria-label="HTTP 凭据管理"
      onCancel={(event) => {
        if (lockRef.current) event.preventDefault();
        else onClose();
      }}
      className="fixed inset-0 m-auto max-h-[88dvh] w-[min(920px,92vw)] overflow-auto rounded-2xl border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <header className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">HTTP 凭据管理</h2>
        <button type="button" className={button} onClick={onClose} disabled={busy}>
          关闭
        </button>
      </header>
      <p className="mb-4 text-sm text-muted-foreground">
        这里只管理密钥与使用权限。URL、参数、请求体及响应提取统一在工作流的 HTTP
        节点配置。密钥保存后不会回显。
      </p>
      <div className="mb-4 flex gap-2">
        <select
          aria-label="选择管理凭据"
          className={control}
          value={id}
          disabled={busy}
          onChange={(event) => {
            const next = event.target.value;
            setId(next);
            setDetail(null);
            setForm(empty());
            setLoading(!!next);
            setError(null);
            setMessage("");
          }}
        >
          <option value="">新建凭据</option>
          {list.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.enabled ? "" : "（已停用）"}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`${button} shrink-0`}
          disabled={busy}
          onClick={() => setRefresh((value) => value + 1)}
        >
          刷新
        </button>
      </div>
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mb-4 rounded-lg bg-primary/5 p-3 text-sm">
          {message}
        </p>
      )}
      {loading && <p className="mb-4 text-sm">正在读取凭据…</p>}
      <CredentialFormFields controller={controller} />
      {detail && <CredentialRevisions controller={controller} />}
      {id && detail && (
        <div className="mt-6 border-t pt-5">
          <h3 className="mb-3 font-semibold">凭据访问权限</h3>
          <CredentialAccess key={id} id={id} />
        </div>
      )}
    </dialog>
  );
}
