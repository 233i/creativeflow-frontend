"use client";
import type { CredentialManagerController } from "@/features/http-requests/controllers/use-credential-manager";
import { button, control } from "@/features/http-requests/credential-form";
export function CredentialHeaderFields({
  controller,
}: {
  controller: CredentialManagerController;
}) {
  const { id, form, setForm } = controller;
  return (
    <>
      {" "}
      {form.headers.map((row, index) => (
        <div key={index} className="flex items-end gap-2">
          <label className="min-w-0 flex-1 space-y-1 text-sm">
            请求头名称
            <input
              aria-label={`凭据请求头 ${index + 1} 名称`}
              disabled={!!id}
              className={control}
              value={row.name}
              maxLength={128}
              onChange={(event) =>
                setForm({
                  ...form,
                  headers: form.headers.map((item, i) =>
                    i === index ? { ...item, name: event.target.value } : item,
                  ),
                })
              }
            />
          </label>
          <label className="min-w-0 flex-[2] space-y-1 text-sm">
            凭据值
            <input
              type="password"
              autoComplete="new-password"
              aria-label={`凭据请求头 ${index + 1} 值`}
              className={control}
              value={row.value}
              maxLength={4096}
              placeholder={id ? "留空沿用同站点的原值" : "例如 Bearer your-token"}
              onChange={(event) =>
                setForm({
                  ...form,
                  headers: form.headers.map((item, i) =>
                    i === index ? { ...item, value: event.target.value } : item,
                  ),
                })
              }
            />
          </label>
          <button
            type="button"
            aria-label={`删除凭据请求头 ${index + 1}`}
            className={button}
            disabled={!!id}
            onClick={() =>
              setForm({ ...form, headers: form.headers.filter((_, i) => i !== index) })
            }
          >
            删除
          </button>
        </div>
      ))}
      <button
        type="button"
        className={button}
        disabled={!!id || form.headers.length >= 8}
        onClick={() => setForm({ ...form, headers: [...form.headers, { name: "", value: "" }] })}
      >
        添加凭据请求头
      </button>
    </>
  );
}
