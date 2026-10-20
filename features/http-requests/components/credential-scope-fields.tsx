"use client";
import type { CredentialManagerController } from "@/features/http-requests/controllers/use-credential-manager";
import { button, control } from "@/features/http-requests/credential-form";
import { HTTP_METHODS } from "@/features/workflow/v2/http-types";
export function CredentialScopeFields({ controller }: { controller: CredentialManagerController }) {
  const { id, form, setForm } = controller;
  return (
    <fieldset disabled={!!id} className="space-y-2">
      <legend className="mb-2 text-sm font-medium">允许使用凭据的接口范围</legend>
      {form.requests.map((scope, index) => (
        <div key={index} className="flex gap-2">
          <select
            aria-label={`授权接口 ${index + 1} 方法`}
            className="rounded-lg border bg-background px-2 text-sm"
            value={scope.method}
            onChange={(event) =>
              setForm({
                ...form,
                requests: form.requests.map((item, i) =>
                  i === index ? { ...item, method: event.target.value } : item,
                ),
              })
            }
          >
            {HTTP_METHODS.map((method) => (
              <option key={method}>{method}</option>
            ))}
          </select>
          <input
            aria-label={`授权接口 ${index + 1} 地址`}
            className={control}
            value={scope.url}
            placeholder="https://api.example.com/query"
            onChange={(event) =>
              setForm({
                ...form,
                requests: form.requests.map((item, i) =>
                  i === index ? { ...item, url: event.target.value } : item,
                ),
              })
            }
          />
          <button
            type="button"
            aria-label={`删除授权接口 ${index + 1}`}
            className={button}
            disabled={form.requests.length <= 1}
            onClick={() =>
              setForm({ ...form, requests: form.requests.filter((_, i) => i !== index) })
            }
          >
            删除
          </button>
        </div>
      ))}
      <button
        type="button"
        className={button}
        disabled={form.requests.length >= 32}
        onClick={() =>
          setForm({
            ...form,
            requests: [...form.requests, { method: "GET", url: form.origin }],
          })
        }
      >
        添加授权接口
      </button>
    </fieldset>
  );
}
