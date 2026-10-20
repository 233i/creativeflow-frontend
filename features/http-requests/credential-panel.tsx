"use client";

import { useEffect, useState } from "react";
import { KeyRound, Plus, RefreshCw, Search } from "lucide-react";
import { credentialApi, type HttpCredentialSummary } from "./credentials-api";
import { CredentialManager } from "./credential-manager";

/** 后台凭据入口只管理认证、版本和授权；请求编排留在工作流画布。 */
export function CredentialPanel() {
  const [items, setItems] = useState<HttpCredentialSummary[]>([]);
  const [search, setSearch] = useState("");
  const [state, setState] = useState("all");
  const [revision, refresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, select] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    void credentialApi
      .list()
      .then((value) => {
        if (!disposed) {
          setItems(value);
          setError("");
        }
      })
      .catch((cause) => {
        if (!disposed) setError(cause instanceof Error ? cause.message : "凭据加载失败。");
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [revision]);
  const filtered = items.filter(
    (item) =>
      `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase()) &&
      (state === "all" || item.enabled === (state === "enabled")),
  );
  const button =
    "inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50";
  return (
    <section aria-label="凭据管理" className="flex min-h-0 flex-1 flex-col gap-5 p-5 lg:p-7">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <KeyRound className="size-6 text-primary" />
            凭据管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            集中保管密钥，按接口授权。请求参数与响应映射在 HTTP 节点中配置。
          </p>
        </div>
        <button
          className={`${button} bg-primary text-primary-foreground hover:bg-primary/90`}
          onClick={() => select("")}
        >
          <Plus className="size-4" />
          新建凭据
        </button>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            aria-label="搜索凭据"
            className="w-full bg-transparent py-2 text-sm outline-none"
            placeholder="搜索名称或用途"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <select
          aria-label="凭据状态筛选"
          className="rounded-lg border bg-background px-3 py-2 text-sm"
          value={state}
          onChange={(event) => setState(event.target.value)}
        >
          <option value="all">全部状态 · {items.length}</option>
          <option value="enabled">已启用</option>
          <option value="disabled">已停用</option>
        </select>
        <button
          className={button}
          disabled={loading}
          onClick={() => {
            setLoading(true);
            refresh((value) => value + 1);
          }}
        >
          <RefreshCw className="size-4" />
          刷新
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">凭据名称 / 用途</th>
              <th className="p-3 font-medium">状态</th>
              <th className="p-3 font-medium">当前版本</th>
              <th className="p-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-t hover:bg-muted/25">
                <td className="p-3">
                  <button
                    className="font-medium text-primary hover:underline"
                    onClick={() => select(item.id)}
                  >
                    {item.name}
                  </button>
                  <p className="mt-1 max-w-xl truncate text-xs text-muted-foreground">
                    {item.description || "未填写用途说明"}
                  </p>
                </td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${item.enabled ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                  >
                    {item.enabled ? "已启用" : "已停用"}
                  </span>
                </td>
                <td className="p-3 font-mono text-xs text-muted-foreground">
                  {item.currentRevision?.slice(-12) || "未配置"}
                </td>
                <td className="p-3 text-right">
                  <button className={button} onClick={() => select(item.id)}>
                    配置与授权
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={4} className="p-12 text-center text-muted-foreground">
                  {loading
                    ? "正在加载凭据…"
                    : error
                      ? "列表暂不可用，请重试。"
                      : search || state !== "all"
                        ? "没有匹配的凭据。"
                        : "暂无凭据。可在此新建，或从 HTTP 节点创建并引用。"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        启用不等于授权。普通用户与 API Key
        需分别授权；停用或撤权将阻止后续调用和相关结果读取。凭据变更生成不可变版本，不覆盖已发布配置。
      </p>
      {selected !== null && (
        <CredentialManager
          initialId={selected}
          onClose={() => {
            select(null);
            refresh((value) => value + 1);
          }}
        />
      )}
    </section>
  );
}
