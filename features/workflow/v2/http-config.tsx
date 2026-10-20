"use client";

import { useEffect, useRef, useState } from "react";
import { credentialApi, type HttpCredentialDetail } from "@/features/http-requests/credentials-api";
import { CredentialManager } from "@/features/http-requests/credential-manager";
import {
  defaultHttpRequest,
  HTTP_METHODS,
  httpConfigurationError,
  type HttpNodeRequest,
  type HttpPair,
} from "./http-types";
import { SchemaValueEditor } from "./schema-editor";
import type { WorkflowField, WorkflowV2NodeData } from "./types";

const control =
  "w-full rounded-lg border bg-background px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/25";
const button = "rounded-lg border px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-40";

/** 在光标处插入输入变量，字符串和 JSON 的具体展开由服务端统一处理。 */
function TemplateInput({
  label,
  value,
  fields,
  onChange,
  rows,
  placeholder,
}: {
  label: string;
  value: string;
  fields: WorkflowField[];
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const input = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const attributes = {
    "aria-label": label,
    className: control,
    value,
    placeholder,
    maxLength: 1048576,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value),
  };
  return (
    <div className="min-w-0 space-y-1">
      {rows ? (
        <textarea
          {...attributes}
          rows={rows}
          ref={(element) => {
            input.current = element;
          }}
        />
      ) : (
        <input
          {...attributes}
          ref={(element) => {
            input.current = element;
          }}
        />
      )}
      <select
        aria-label={`${label}插入变量`}
        value=""
        className="max-w-full rounded border bg-background px-1 py-1 text-[11px] text-primary"
        onChange={(event) => {
          const field = event.target.value;
          if (!field) return;
          const start = input.current?.selectionStart ?? value.length;
          const end = input.current?.selectionEnd ?? start;
          onChange(value.slice(0, start) + `{{${field}}}` + value.slice(end));
        }}
      >
        <option value="">插入输入变量…</option>
        {fields.map((field) => (
          <option key={field.key} value={field.key}>
            {field.label || field.key} · {field.key}
          </option>
        ))}
      </select>
    </div>
  );
}

function Pairs({
  label,
  value,
  fields,
  onChange,
}: {
  label: string;
  value: HttpPair[];
  fields: WorkflowField[];
  onChange: (value: HttpPair[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-xs font-medium">{label}</legend>
      {value.map((pair, index) => (
        <div key={index} className="space-y-2 rounded-lg border p-2">
          <div className="flex items-center gap-2">
            <input
              aria-label={`${label} ${index + 1} 名称`}
              className={control}
              maxLength={128}
              placeholder="名称"
              value={pair.name}
              onChange={(event) =>
                onChange(
                  value.map((item, i) =>
                    i === index ? { ...item, name: event.target.value } : item,
                  ),
                )
              }
            />
            <button
              type="button"
              aria-label={`删除${label} ${index + 1}`}
              className={button}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </div>
          <TemplateInput
            label={`${label} ${index + 1} 值`}
            value={pair.value}
            fields={fields}
            onChange={(text) =>
              onChange(value.map((item, i) => (i === index ? { ...item, value: text } : item)))
            }
            placeholder="固定值或 {{输入变量}}"
          />
        </div>
      ))}
      <button
        type="button"
        className={button}
        disabled={value.length >= 24}
        onClick={() => onChange([...value, { name: "", value: "" }])}
      >
        添加{label}
      </button>
    </fieldset>
  );
}

/** 节点内直接配置 HTTP；凭据只保留 ID/版本，响应字段可直接连到下游。 */
export function HttpRequestConfig({
  data,
  admin,
  onChange,
}: {
  data: WorkflowV2NodeData<"httpRequest">;
  admin: boolean;
  onChange: (data: WorkflowV2NodeData<"httpRequest">) => void;
}) {
  const http = data.http ?? defaultHttpRequest();
  const [catalog, setCatalog] = useState<HttpCredentialDetail[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [manage, setManage] = useState(false);
  const credential = catalog.find((item) => item.id === data.credentialId);
  const error = httpConfigurationError(data);
  const update = (patch: Partial<HttpNodeRequest>) =>
    onChange({ ...data, http: { ...http, ...patch } });
  useEffect(() => {
    let disposed = false;
    void credentialApi
      .catalog(admin)
      .then((value) => {
        if (!disposed) {
          setCatalog(value);
          setCatalogError(null);
        }
      })
      .catch(() => {
        if (!disposed) {
          setCatalog([]);
          setCatalogError("凭据目录暂不可用，请刷新。");
        }
      });
    return () => {
      disposed = true;
    };
  }, [admin, refresh]);
  function changeOutput(index: number, field: WorkflowField) {
    const previous = data.outputFields?.[index];
    if (!previous) return;
    const extract = { ...data.extract };
    const path = extract[previous.key] ?? "";
    delete extract[previous.key];
    extract[field.key] = path;
    onChange({
      ...data,
      outputFields: data.outputFields!.map((item, i) => (i === index ? field : item)),
      extract,
    });
  }
  return (
    <section aria-label="HTTP 请求设置" className="space-y-4 rounded-xl border bg-muted/15 p-3">
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <label className="block space-y-1 text-xs">
        请求方法
        <select
          aria-label="HTTP 请求方法"
          className={control}
          value={http.method}
          onChange={(event) => {
            const method = event.target.value as HttpNodeRequest["method"];
            update({
              method,
              ...(["GET", "HEAD"].includes(method) ? { bodyType: "none" as const } : {}),
            });
          }}
        >
          {HTTP_METHODS.map((method) => (
            <option key={method}>{method}</option>
          ))}
        </select>
      </label>
      <div className="space-y-1">
        <p className="text-xs">请求 URL</p>
        <TemplateInput
          label="HTTP 请求 URL"
          value={http.url}
          fields={data.fields}
          onChange={(url) => update({ url })}
          placeholder="https://api.example.com/query"
        />
        <p className="text-[11px] text-muted-foreground">
          路径和查询参数可引用输入变量；变量来源在下方“节点输入”中连接。
        </p>
      </div>
      <Pairs
        label="查询参数"
        value={http.query}
        fields={data.fields}
        onChange={(query) => update({ query })}
      />
      <Pairs
        label="请求头"
        value={http.headers}
        fields={data.fields}
        onChange={(headers) => update({ headers })}
      />
      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center justify-between">
          <strong className="text-xs">鉴权凭据</strong>
          <button type="button" className={button} onClick={() => setRefresh((value) => value + 1)}>
            刷新凭据
          </button>
        </div>
        {catalogError && (
          <p role="alert" className="text-xs text-destructive">
            {catalogError}
          </p>
        )}
        <select
          aria-label="HTTP 鉴权凭据"
          className={control}
          value={data.credentialId ?? ""}
          onChange={(event) => {
            const selected = catalog.find((item) => item.id === event.target.value);
            onChange({
              ...data,
              credentialId: selected?.id ?? "",
              credentialRevisionId: selected?.currentRevision ?? selected?.revisions[0]?.id ?? "",
            });
          }}
        >
          <option value="">无需凭据</option>
          {data.credentialId && !credential && (
            <option value={data.credentialId}>原凭据不可用或未获授权</option>
          )}
          {catalog.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        {credential && (
          <label className="block space-y-1 text-xs">
            凭据版本
            <select
              aria-label="HTTP 凭据版本"
              className={control}
              value={data.credentialRevisionId ?? ""}
              onChange={(event) => onChange({ ...data, credentialRevisionId: event.target.value })}
            >
              <option value="">请选择版本</option>
              {data.credentialRevisionId &&
                !credential.revisions.some((item) => item.id === data.credentialRevisionId) && (
                  <option value={data.credentialRevisionId}>原版本不可用</option>
                )}
              {credential.revisions.map((item) => (
                <option key={item.id} value={item.id}>
                  {new Date(item.createdAt).toLocaleString()}
                  {item.id === credential.currentRevision ? "（当前）" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {credential && (
          <p className="break-all text-[11px] text-muted-foreground">
            适用站点：
            {
              credential.revisions.find((item) => item.id === data.credentialRevisionId)?.definition
                .origin
            }
          </p>
        )}
        {credential && (
          <div className="space-y-1 rounded-lg bg-muted/40 p-2 text-[11px]">
            <p className="font-medium">凭据允许的接口</p>
            {credential.revisions
              .find((item) => item.id === data.credentialRevisionId)
              ?.definition.requests.map((scope, index) => (
                <p key={index} className="break-all">
                  {scope.method} {scope.url}
                </p>
              ))}
            {credential.revisions.find((item) => item.id === data.credentialRevisionId)?.definition
              .requestDigest && (
              <p className="text-amber-700">
                迁移凭据：参数映射和输出契约已锁定，不能修改后继续使用原授权。
              </p>
            )}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Authorization、API Key 等认证头通过凭据引用，密钥不会写入工作流。
        </p>
        {admin && (
          <button type="button" className={button} onClick={() => setManage(true)}>
            管理 HTTP 凭据
          </button>
        )}
      </div>
      <label className="block space-y-1 text-xs">
        请求体类型
        <select
          aria-label="HTTP 请求体类型"
          className={control}
          value={http.bodyType}
          disabled={["GET", "HEAD"].includes(http.method)}
          onChange={(event) =>
            update({
              bodyType: event.target.value as HttpNodeRequest["bodyType"],
              ...(event.target.value === "json" && !http.body ? { body: "{}" } : {}),
            })
          }
        >
          <option value="none">无请求体</option>
          <option value="json">JSON</option>
          <option value="text">文本</option>
          <option value="form">表单（URL 编码）</option>
        </select>
      </label>
      {http.bodyType === "form" ? (
        <Pairs
          label="表单字段"
          value={http.form}
          fields={data.fields}
          onChange={(form) => update({ form })}
        />
      ) : (
        ["json", "text"].includes(http.bodyType) && (
          <div className="space-y-2">
            <TemplateInput
              label="HTTP 请求正文"
              rows={6}
              value={http.body}
              fields={data.fields}
              onChange={(body) => update({ body })}
            />
            {http.bodyType === "json" && (
              <p className="text-[11px] leading-5 text-muted-foreground">
                {
                  '示例：{"query":"{{question}}"}。整个值引用变量时保留数字、对象、数组等原类型；字符串内部引用会自动转义。'
                }
              </p>
            )}
          </div>
        )
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs">
          超时（秒）
          <input
            aria-label="HTTP 超时秒数"
            className={control}
            type="number"
            min={1}
            max={120}
            value={http.timeoutSeconds}
            onChange={(event) => update({ timeoutSeconds: Number(event.target.value) })}
          />
        </label>
        <label className="space-y-1 text-xs">
          响应上限（字节，最多 1 MiB）
          <input
            aria-label="HTTP 响应字节上限"
            className={control}
            type="number"
            min={1024}
            max={1048576}
            value={http.responseLimitBytes}
            onChange={(event) => update({ responseLimitBytes: Number(event.target.value) })}
          />
        </label>
      </div>
      <label className="flex items-start gap-2 text-xs">
        <input
          aria-label="HTTP 非成功状态时报错"
          type="checkbox"
          checked={http.failOnHttpError}
          onChange={(event) => update({ failOnHttpError: event.target.checked })}
        />
        非 2xx 状态时将节点标记为失败
      </label>
      <p className="text-[11px] leading-5 text-muted-foreground">
        取消勾选后，错误响应也会输出给下游，可按 statusCode
        分支处理。每次执行只发送一次请求，超时不自动重试。
      </p>
      <div className="space-y-3 border-t pt-3">
        <strong className="text-xs">响应输出</strong>
        <label className="block space-y-1 text-xs">
          输出模式
          <select
            aria-label="HTTP 响应输出模式"
            className={control}
            value={data.responseMode ?? "full"}
            onChange={(event) =>
              onChange({ ...data, responseMode: event.target.value as "full" | "fields" })
            }
          >
            <option value="full">状态码、正文、响应头 + 提取字段</option>
            <option value="fields">仅提取字段（空值按缺失处理）</option>
          </select>
        </label>
        <p className="text-[11px] leading-5 text-muted-foreground">
          响应正文最大 1 MiB。statusCode 为数字，body 为文本，headers 为对象；每个字段支持 1
          MiB，正文与提取副本合计受 2 MiB
          预算约束。仅提取模式不输出状态、正文和响应头，适合避免重复传递大数据。已有下游字段若配置更小的上限，仍按其约束校验。
        </p>
        {(data.outputFields ?? []).map((field, index) => (
          <div key={index} className="space-y-2 rounded-lg border p-2">
            <div className="flex gap-2">
              <input
                aria-label={`HTTP 提取字段 ${index + 1} 标识`}
                className={control}
                value={field.key}
                placeholder="result"
                onChange={(event) => changeOutput(index, { ...field, key: event.target.value })}
              />
              <button
                type="button"
                aria-label={`删除 HTTP 提取字段 ${index + 1}`}
                className={button}
                onClick={() => {
                  const extract = { ...data.extract };
                  delete extract[field.key];
                  onChange({
                    ...data,
                    outputFields: data.outputFields!.filter((_, i) => i !== index),
                    extract,
                  });
                }}
              >
                ×
              </button>
            </div>
            <SchemaValueEditor
              field={field}
              allowImage={false}
              onChange={(value) => changeOutput(index, value)}
            />
            <label className="block space-y-1 text-xs">
              JSON 路径
              <input
                aria-label={`HTTP 提取字段 ${index + 1} 路径`}
                className={control}
                placeholder="/data/result（留空为完整 JSON）"
                value={data.extract?.[field.key] ?? ""}
                onChange={(event) =>
                  onChange({
                    ...data,
                    extract: { ...data.extract, [field.key]: event.target.value },
                  })
                }
              />
            </label>
          </div>
        ))}
        <button
          type="button"
          className={button}
          disabled={(data.outputFields?.length ?? 0) >= (data.responseMode === "fields" ? 16 : 13)}
          onClick={() => {
            let suffix = 1;
            const names = new Set(data.outputFields?.map((item) => item.key));
            while (names.has(`result${suffix}`)) suffix++;
            const key = `result${suffix}`;
            onChange({
              ...data,
              outputFields: [...(data.outputFields ?? []), { key, type: "string", required: true }],
              extract: { ...data.extract, [key]: "/data/result" },
            });
          }}
        >
          添加 JSON 提取字段
        </button>
      </div>
      {manage && (
        <CredentialManager
          initialId={data.credentialId}
          initialScope={{ method: http.method, url: http.url }}
          onClose={() => {
            setManage(false);
            setRefresh((value) => value + 1);
          }}
          onSaved={(credentialId, credentialRevisionId) => {
            onChange({ ...data, credentialId, credentialRevisionId });
            setRefresh((value) => value + 1);
          }}
        />
      )}
    </section>
  );
}
