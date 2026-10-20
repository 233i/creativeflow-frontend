"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ManagedUser } from "@/features/admin/api";
import { useAdminQuery } from "../admin-query";
import { DetailDrawer } from "../detail-drawer";
import {
  getRequest,
  listRequests,
  type RequestDetail,
  type RequestPage,
  type RequestSource,
} from "./api";
import { formatTime, kindLabel, RequestDetailView, RequestStatus } from "./request-detail";

/** 统一运行查看入口；原记录类型和无法关联工作流的历史记录仍可独立检索。 */
export function RequestHistoryPanel({ initialUser }: { initialUser?: ManagedUser | null }) {
  const [params, update] = useAdminQuery();
  const [legacyUser, setLegacyUser] = useState(initialUser?.id ?? "");
  const source: RequestSource = params.get("recordSource") === "workflow" ? "workflow" : "canvas";
  const accountId = params.get("accountId") ?? legacyUser;
  const search = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const limit = params.get("size") === "50" ? 50 : 20;
  const number = Math.max(
    1,
    Math.min(1000000, Number.parseInt(params.get("page") ?? "1", 10) || 1),
  );
  const query = useMemo(
    () => ({ source, accountId, search, status, offset: (number - 1) * limit, limit }),
    [source, accountId, search, status, number, limit],
  );
  const key = JSON.stringify(query);
  const [data, setData] = useState<{ key: string; page: RequestPage } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string; denied: boolean } | null>(
    null,
  );
  const [refresh, setRefresh] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const page = data?.key === key ? data.page : null;
  const error = failure?.key === key ? failure : null;
  const selected = params.get("requestId");
  const loading = pending === key || (!page && !error);

  useEffect(() => {
    if (legacyUser && !params.has("accountId")) update({ accountId: legacyUser });
  }, [legacyUser, params, update]);
  useEffect(() => {
    let current = true;
    const timer = window.setTimeout(() => {
      setPending(key);
      void listRequests(JSON.parse(key))
        .then((value) => {
          if (current) {
            setData({ key, page: value });
            setFailure(null);
          }
        })
        .catch((reason: unknown) => {
          if (!current) return;
          const denied = isDenied(reason);
          setData(null);
          setFailure({
            key,
            denied,
            message: denied
              ? "管理员会话或访问权限已失效，请重新登录后查看。"
              : reason instanceof Error
                ? reason.message
                : "运行记录查询失败，请重新查询。",
          });
          if (denied) update({ requestId: null });
        })
        .finally(() => {
          if (current) setPending(null);
        });
    }, 180);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [key, refresh, update]);
  useEffect(() => {
    if (page && scroll.current)
      try {
        scroll.current.scrollTop =
          Number(sessionStorage.getItem(`creativeflow.admin.runScroll:${key}`)) || 0;
      } catch {
        /* 布局偏好不可写不影响请求。 */
      }
  }, [page, key]);

  function filter(values: Record<string, string | null>) {
    update({ ...values, page: null, requestId: null });
  }
  function clear() {
    setLegacyUser("");
    filter({ accountId: null, q: null, status: null });
  }
  const hasFilters = !!(accountId || search || status);
  return (
    <section className="sol-admin-panel relative" aria-label="运行中心">
      <header className="sol-admin-panel-header">
        <div className="flex items-center gap-2">
          <h2>运行中心</h2>
          <span className="text-sm text-muted-foreground">{page?.total ?? "—"}</span>
        </div>
        <Button
          variant="outline"
          isDisabled={loading || error?.denied}
          onPress={() => setRefresh((value) => value + 1)}
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          重新查询
        </Button>
      </header>
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <div role="group" aria-label="记录来源" className="flex gap-1">
          {(["canvas", "workflow"] as const).map((value) => (
            <button
              key={value}
              className="sol-admin-control"
              aria-pressed={source === value}
              onClick={() => filter({ recordSource: value })}
            >
              {value === "canvas" ? "画布记录" : "工作流记录"}
            </button>
          ))}
        </div>
        <input
          className="sol-admin-control min-w-48 flex-1"
          aria-label="筛选请求用户"
          placeholder="按用户昵称、邮箱或用户 ID 筛选"
          value={search}
          maxLength={200}
          onChange={(event) => filter({ q: event.target.value })}
        />
        <select
          aria-label="请求状态"
          className="sol-admin-control"
          value={status}
          onChange={(event) => filter({ status: event.target.value })}
        >
          <option value="">全部状态</option>
          {[
            ["succeeded", "成功"],
            ["failed", "失败"],
            ["cancelled", "已取消"],
            ["running", "进行中"],
            ["queued", "排队中"],
            ["pending", "等待中"],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="每页记录条数"
          className="sol-admin-control"
          value={limit}
          onChange={(event) => filter({ size: event.target.value })}
        >
          <option value="20">20 条 / 页</option>
          <option value="50">50 条 / 页</option>
        </select>
      </div>
      {hasFilters && (
        <div className="mb-2 flex flex-wrap gap-2 text-sm">
          {accountId && (
            <button
              className="sol-admin-control"
              aria-label="清除用户筛选"
              title={accountId}
              onClick={() => {
                setLegacyUser("");
                filter({ accountId: null });
              }}
            >
              用户：
              {initialUser?.id === accountId ? initialUser.displayName : accountId.slice(0, 8)} ×
            </button>
          )}
          {search && (
            <button
              className="sol-admin-control max-w-full truncate"
              onClick={() => filter({ q: null })}
            >
              搜索：{search} ×
            </button>
          )}
          {status && (
            <button className="sol-admin-control" onClick={() => filter({ status: null })}>
              清除状态筛选 ×
            </button>
          )}
          <button className="sol-admin-row-action" onClick={clear}>
            清空筛选
          </button>
        </div>
      )}
      {source === "canvas" && (
        <details className="mb-2 shrink-0 text-sm text-muted-foreground">
          <summary className="cursor-pointer">包含未关联画布的历史视频任务</summary>
          <p className="py-2">
            保留原请求、用户、模型与节点诊断。上线前未记录的文本和失败请求无法还原；查看不会再次生成。
          </p>
        </details>
      )}
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error.message}
        </p>
      )}
      <div
        ref={scroll}
        className="sol-admin-table-region"
        onScroll={(event) => {
          try {
            sessionStorage.setItem(
              `creativeflow.admin.runScroll:${key}`,
              String(event.currentTarget.scrollTop),
            );
          } catch {
            /* 忽略纯布局存储失败。 */
          }
        }}
      >
        <table
          className="sol-admin-table min-w-[820px]"
          aria-label="运行记录列表"
          aria-busy={loading}
        >
          <thead>
            <tr>
              <th>用户</th>
              <th>{source === "canvas" ? "画布 / 节点" : "工作流"}</th>
              <th>类型 / 模型</th>
              <th>状态</th>
              <th>提交时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {page?.items.map((row) => (
              <tr key={`${row.source}:${row.id}`}>
                <td>
                  <div
                    className="max-w-44 truncate"
                    title={row.email ?? row.accountId ?? undefined}
                  >
                    {row.userName ?? "历史用户未关联"}
                  </div>
                </td>
                <td>
                  <button
                    className="sol-admin-row-title block max-w-64 truncate"
                    title={row.nodeId ?? row.id}
                    onClick={() => update({ requestId: row.id })}
                  >
                    {row.projectName || "未关联工作流"}
                  </button>
                  {row.historical && (
                    <span className="text-[13px] text-muted-foreground">历史记录</span>
                  )}
                </td>
                <td>
                  <div className="max-w-48 truncate" title={row.providerName ?? undefined}>
                    {kindLabel(row.kind)} · {row.modelKey ?? "按节点查看"}
                  </div>
                </td>
                <td>
                  <RequestStatus status={row.status} />
                </td>
                <td>
                  <time dateTime={row.createdAt} title={formatTime(row.createdAt)}>
                    {new Date(row.createdAt).toLocaleString("zh-CN", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </time>
                </td>
                <td>
                  <button
                    className="sol-admin-row-action"
                    onClick={() => update({ requestId: row.id })}
                  >
                    查看详情
                  </button>
                </td>
              </tr>
            ))}
            {!page && !error && (
              <tr>
                <td colSpan={6} role="status">
                  正在读取运行记录…
                </td>
              </tr>
            )}
            {page?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="!py-10 text-center">
                  {hasFilters || number > 1 ? "没有匹配的请求记录" : "尚未记录运行"}
                  {hasFilters && (
                    <button className="sol-admin-row-action ml-3" onClick={clear}>
                      清空筛选
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="sol-admin-pagination">
        <span>
          共 {page?.total ?? "—"} 条{loading && page && " · 更新中"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            isDisabled={number === 1 || loading}
            onPress={() => update({ page: String(number - 1), requestId: null })}
          >
            上一页
          </Button>
          <span>
            {number} / {page ? Math.max(1, Math.ceil(page.total / limit)) : "—"}
          </span>
          <Button
            variant="outline"
            isDisabled={!page || number * limit >= page.total || loading}
            onPress={() => update({ page: String(number + 1), requestId: null })}
          >
            下一页
          </Button>
        </div>
      </footer>
      {selected && !error?.denied && (
        <RequestInspector
          key={`${source}:${selected}:${key}`}
          source={source}
          id={selected}
          onClose={() => update({ requestId: null })}
        />
      )}
    </section>
  );
}

function isDenied(reason: unknown) {
  return (
    !!reason &&
    typeof reason === "object" &&
    "status" in reason &&
    [401, 403, 404].includes(Number(reason.status))
  );
}

/** 详情不进入 URL 或持久化缓存；重新查询失败时移除旧正文，撤权后停止自动读取。 */
function RequestInspector({
  source,
  id,
  onClose,
}: {
  source: RequestSource;
  id: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [error, setError] = useState<{ message: string; denied: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    let pending = false;
    let denied = false;
    async function query() {
      if (pending || denied) return;
      pending = true;
      try {
        const value = await getRequest(source, id);
        if (current) {
          setDetail(value);
          setError(null);
        }
      } catch (reason) {
        denied = isDenied(reason);
        if (current) {
          setDetail(null);
          setError({
            denied,
            message: denied
              ? "该记录已不可访问，受限内容已清空。"
              : "连接中断，请重新查询；不会重新生成。",
          });
        }
      } finally {
        pending = false;
      }
    }
    void query();
    const timer = window.setInterval(() => void query(), 3000);
    const visible = () => {
      if (document.visibilityState === "visible") void query();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [source, id, retry]);
  return (
    <DetailDrawer
      title="请求详情"
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onPress={onClose}>
            关闭
          </Button>
          {!error?.denied && (
            <Button variant="outline" onPress={() => setRetry((value) => value + 1)}>
              重新查询
            </Button>
          )}
        </>
      }
    >
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : detail ? (
        <RequestDetailView detail={detail} />
      ) : (
        <p role="status" className="text-sm">
          正在加载请求详情…
        </p>
      )}
    </DetailDrawer>
  );
}
