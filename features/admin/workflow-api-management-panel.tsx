"use client";

import { Braces, Pencil, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Input, PrimaryTable, Tag, type PrimaryTableCol } from "tdesign-react";
import { editorApi, listWorkflowApis, type ManagedWorkflowApi } from "./workflow-api";
import type { WorkflowDocument } from "@/features/workflow/api";
import { WorkflowPublishPanel } from "@/features/workflow/external-api/publish-panel";
import { createStarterWorkflow } from "@/features/workflow/template";
import { createV2Workflow, type WorkflowV2Graph } from "@/features/workflow/v2/types";
import { isTypedWorkflowGraph } from "@/features/workflow/types";
import { v2PublicationManifest } from "@/features/workflow/external-api/contracts";

const statusLabels = { draft: "草稿", published: "已发布", disabled: "已停用" };
const dateFormatter = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" });

/** API 的统一管理入口，发布、密钥和调用记录复用工作流发布面板。 */
export function WorkflowApiManagementPanel() {
  const router = useRouter();
  const [apis, setApis] = useState<ManagedWorkflowApi[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<WorkflowDocument | null>(null);
  const [workflowEnabled, setWorkflowEnabled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setApis((await listWorkflowApis()).apis);
      try {
        setWorkflowEnabled((await editorApi.getWorkflowCapabilities()).enabled);
      } catch {
        setWorkflowEnabled(false);
      }
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载 API 失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function create(v2 = false) {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await editorApi.createWorkflow(
        v2 ? "AI 工作流（调试）" : "未命名 API",
        v2 ? createV2Workflow() : createStarterWorkflow(),
      );
      router.push(`/admin/workflow-apis/${encodeURIComponent(created.id)}/edit`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "新建 API 失败");
      setCreating(false);
    }
  }

  async function manage(id: string) {
    setPendingId(id);
    setError(null);
    try {
      const value = await editorApi.getWorkflow(id);
      setDocument(value);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载 API 失败");
    } finally {
      setPendingId(null);
    }
  }

  const visible = apis.filter(
    (api) =>
      (!status || api.status === status) &&
      `${api.name} ${api.id}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const columns: PrimaryTableCol<ManagedWorkflowApi>[] = [
    {
      colKey: "name",
      title: "API",
      minWidth: 260,
      cell: ({ row }) => (
        <div className="py-1">
          <p className="text-sm font-medium">{row.name}</p>
          <p className="mt-1 truncate font-mono text-xs text-[var(--td-text-color-secondary)]">
            {row.id}
          </p>
        </div>
      ),
    },
    {
      colKey: "status",
      title: "状态",
      width: 110,
      cell: ({ row }) => (
        <Tag
          theme={
            row.status === "published"
              ? "success"
              : row.status === "disabled"
                ? "warning"
                : "default"
          }
          variant="light"
        >
          {statusLabels[row.status]}
        </Tag>
      ),
    },
    {
      colKey: "version",
      title: "最新版本",
      width: 110,
      cell: ({ row }) => (row.version ? `v${row.version}` : "未发布"),
    },
    {
      colKey: "updatedAt",
      title: "更新时间",
      width: 180,
      cell: ({ row }) => dateFormatter.format(new Date(row.updatedAt)),
    },
    {
      colKey: "operation",
      title: "操作",
      width: 260,
      fixed: "right",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            size="small"
            variant="text"
            icon={<Pencil size={14} aria-hidden />}
            onClick={() => router.push(`/admin/workflow-apis/${encodeURIComponent(row.id)}/edit`)}
          >
            编辑与调试
          </Button>
          <Button
            size="small"
            variant="text"
            icon={<Braces size={14} aria-hidden />}
            loading={pendingId === row.id}
            disabled={pendingId !== null}
            onClick={() => void manage(row.id)}
          >
            发布管理
          </Button>
        </div>
      ),
    },
  ];

  return (
    <section className="sol-admin-panel">
      <header className="sol-admin-panel-header">
        <div>
          <h2>API 管理</h2>
          <p className="text-[var(--td-text-color-secondary)]">
            {apis.length} 个 API · 管理工作流草稿、发布版本、密钥与调用记录
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(value) => setSearch(String(value))}
            clearable
            prefixIcon={<Search size={16} aria-hidden />}
            placeholder="搜索 API 名称或标识"
          />
          <select
            aria-label="API 状态"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-8 rounded-md border border-[var(--td-component-border)] bg-[var(--td-bg-color-container)] px-3 text-sm"
          >
            <option value="">全部状态</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {workflowEnabled && (
            <Button disabled={creating} onClick={() => void create(true)}>
              新建 AI 工作流
            </Button>
          )}
          <Button
            theme="primary"
            icon={<Plus size={16} aria-hidden />}
            loading={creating}
            onClick={() => void create()}
          >
            新建 API
          </Button>
        </div>
      </header>
      <div className="sol-admin-panel-scroll">
        {error && (
          <Alert
            className="mb-4"
            theme="error"
            message={error}
            operation={
              <Button size="small" variant="text" onClick={() => void load()}>
                重试
              </Button>
            }
          />
        )}
        <PrimaryTable
          rowKey="id"
          data={visible}
          columns={columns}
          loading={loading}
          hover
          tableLayout="fixed"
          resizable
          pagination={{ defaultPageSize: 20, total: visible.length }}
          empty="暂无 API，可新建或从工作流模板创建"
        />
      </div>
      {document && (
        <WorkflowPublishPanel
          workflowId={document.id}
          workflowName={document.name}
          updatedAt={document.updatedAt}
          manifest={
            isTypedWorkflowGraph(document.graph)
              ? v2PublicationManifest(document.graph as WorkflowV2Graph)
              : (document.graph?.externalApi ?? { schemaVersion: 1, inputs: [], outputs: [] })
          }
          isOpen
          onBeforePublish={async () => true}
          onOpenChange={(open) => {
            if (!open) {
              setDocument(null);
              void load();
            }
          }}
        />
      )}
    </section>
  );
}
