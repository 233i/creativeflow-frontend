"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Input,
  PrimaryTable,
  Switch,
  Tag,
  type PrimaryTableCol,
} from "tdesign-react";
import * as adminApi from "@/features/admin/api";
import { useAdminQuery } from "./admin-query";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" });

/** 用户列表可触发的管理操作。 */
interface UserManagementPanelProps {
  /** 查看指定用户的请求记录，并将该用户作为精确筛选条件。 */
  onViewRequests?: (user: adminApi.ManagedUser) => void;
}

/** 展示用户并提供账号状态管理和请求历史入口。 */
export function UserManagementPanel({ onViewRequests }: UserManagementPanelProps = {}) {
  const [users, setUsers] = useState<adminApi.ManagedUser[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [params, update] = useAdminQuery();
  const query = params.get("q") ?? "";
  const limit = params.get("size") === "50" ? 50 : 20;
  const page = Math.max(1, Math.min(1000000, Number.parseInt(params.get("page") ?? "1", 10) || 1));
  const offset = (page - 1) * limit;
  const sequence = useRef(0);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** 根据搜索词加载用户列表。 */
  const load = useCallback(
    async (search: string, pageOffset: number) => {
      const request = ++sequence.current;
      setLoading(true);
      setError(null);
      try {
        const result = await adminApi.listUsers(search, pageOffset, limit);
        if (request !== sequence.current) return;
        setUsers(result.users);
        setTotal(result.total);
      } catch (reason) {
        if (request !== sequence.current) return;
        setUsers([]);
        setTotal(null);
        setError(reason instanceof Error ? reason.message : "加载用户失败");
      } finally {
        if (request === sequence.current) setLoading(false);
      }
    },
    [limit],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(query, offset), 250);
    return () => {
      sequence.current += 1;
      window.clearTimeout(timer);
    };
  }, [load, offset, query]);

  /** 保存账号可用状态，并同步当前列表。 */
  async function toggle(user: adminApi.ManagedUser, enabled: boolean) {
    if (!enabled && !window.confirm(`确认禁用 ${user.displayName}？其现有会话会立即失效。`)) return;
    setPendingId(user.id);
    setError(null);
    try {
      await adminApi.setUserEnabled(user.id, enabled);
      setUsers((current) =>
        current.map((entry) => (entry.id === user.id ? { ...entry, isEnabled: enabled } : entry)),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "更新用户状态失败");
    } finally {
      setPendingId(null);
    }
  }

  const columns: PrimaryTableCol<adminApi.ManagedUser>[] = [
    {
      colKey: "displayName",
      title: "用户",
      width: 260,
      cell: ({ row }) => (
        <div className="min-w-0 py-1">
          <p className="truncate text-sm font-medium">{row.displayName}</p>
          <p className="truncate font-mono text-xs text-[var(--td-text-color-placeholder)]">
            {row.id}
          </p>
        </div>
      ),
    },
    {
      colKey: "email",
      title: "邮箱",
      minWidth: 220,
      ellipsis: true,
      cell: ({ row }) => row.email ?? "—",
    },
    {
      colKey: "createdAt",
      title: "注册时间",
      width: 150,
      cell: ({ row }) => dateFormatter.format(new Date(row.createdAt)),
    },
    {
      colKey: "isEnabled",
      title: "可用状态",
      width: 160,
      align: "right",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-3">
          <Tag theme={row.isEnabled ? "success" : "default"} variant="light">
            {row.isEnabled ? "已启用" : "已禁用"}
          </Tag>
          <Switch
            value={row.isEnabled}
            loading={pendingId === row.id}
            disabled={pendingId !== null && pendingId !== row.id}
            aria-label={`${row.displayName}可用状态`}
            onChange={(enabled) => void toggle(row, Boolean(enabled))}
          />
        </div>
      ),
    },
  ];

  // 保留现有开关操作，独立提供查看记录入口，避免误触账号状态。
  if (onViewRequests)
    columns.push({
      colKey: "requests",
      title: "请求记录",
      width: 120,
      cell: ({ row }) => (
        <Button size="small" variant="text" onClick={() => onViewRequests(row)}>
          查看记录
        </Button>
      ),
    });

  return (
    <section className="sol-admin-panel">
      <header className="sol-admin-panel-header">
        <div>
          <h2 className="text-base font-semibold">用户管理</h2>
          <p className="mt-1 text-sm text-[var(--td-text-color-secondary)]">
            共 {total ?? "—"} 个账号，禁用后其现有会话会立即失效。
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <Input
            value={query}
            prefixIcon={<Search size={16} aria-hidden />}
            placeholder="搜索昵称或邮箱"
            maxlength={200}
            clearable
            onChange={(value) => {
              update({ q: String(value), page: null });
            }}
          />
        </div>
      </header>

      <div className="sol-admin-panel-scroll">
        {error && (
          <Alert
            className="mb-4"
            theme="error"
            message={error}
            operation={
              <Button size="small" variant="text" onClick={() => void load(query, offset)}>
                重试
              </Button>
            }
          />
        )}

        <PrimaryTable
          rowKey="id"
          data={users}
          columns={columns}
          loading={loading}
          hover
          disableDataPage
          tableLayout="fixed"
          resizable
          empty="没有匹配的用户"
        />
      </div>
      <footer className="sol-admin-pagination">
        <span>共 {total ?? "—"} 条</span>
        <div className="flex items-center gap-2">
          <select
            className="sol-admin-control"
            aria-label="每页用户数量"
            value={limit}
            onChange={(event) => update({ size: event.target.value, page: null })}
          >
            <option value="20">20 条 / 页</option>
            <option value="50">50 条 / 页</option>
          </select>
          <Button
            variant="outline"
            disabled={loading || page === 1}
            onClick={() => update({ page: String(page - 1) })}
          >
            上一页
          </Button>
          <span>
            {page} / {total === null ? "—" : Math.max(1, Math.ceil(total / limit))}
          </span>
          <Button
            variant="outline"
            disabled={loading || total === null || offset + limit >= total}
            onClick={() => update({ page: String(page + 1) })}
          >
            下一页
          </Button>
        </div>
      </footer>
    </section>
  );
}
