"use client";

import { FileUp, MoreHorizontal, Pencil, Plus, Search } from "lucide-react";
import { Button as MenuButton, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import { useWorkspaceRouter as useRouter } from "@/components/providers/workspace-context";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Input,
  PrimaryTable,
  Select,
  Tag,
  type PrimaryTableCol,
} from "tdesign-react";
import * as adminApi from "@/features/admin/api";
import { copyTemplateGraphForApi } from "@/features/admin/workflow-api";
import { CreateWorkflowDialog, type InitialWorkflow } from "./workflow-center/create-dialog";
import { DeleteWorkflowDialog } from "./workflow-center/delete-dialog";
import { importWorkflow } from "@/features/workflow/persistence";
import { createStarterWorkflow } from "@/features/workflow/template";
import type {
  WorkflowTemplateDocument,
  WorkflowTemplateInput,
  WorkflowTemplateStatus,
  WorkflowTemplateSummary,
} from "@/features/workflow/templates-api";
import type { WorkflowGraph } from "@/features/workflow/types";
import { ManagementDialog as Dialog } from "@/components/ui/management-dialog";
import { useWorkspaceGuard } from "@/components/providers/workspace-context";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

interface TemplateEditor {
  id: string | null;
  status: WorkflowTemplateStatus;
  name: string;
  description: string;
  category: string;
  tags: string;
  graph: WorkflowGraph;
  isFeatured: boolean;
  sortOrder: number;
  sourceFileName: string | null;
}

function useTemplateWorkspace(editor: TemplateEditor | null, busy: boolean) {
  useWorkspaceGuard({
    dirty: !!editor && editor.status !== "published",
    busy,
    message: "模板参数尚未保存，请在原页面确认后再关闭。",
  });
}

export function WorkflowTemplateManagementPanel() {
  const router = useRouter();
  const [templates, setTemplates] = useState<WorkflowTemplateSummary[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<WorkflowTemplateStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<TemplateEditor | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<WorkflowTemplateSummary | null>(null);
  const [copySource, setCopySource] = useState<InitialWorkflow>();
  useTemplateWorkspace(editor, [saving, creating, pendingId !== null].some(Boolean));

  const load = useCallback(async (search: string, nextStatus: WorkflowTemplateStatus | "") => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.listWorkflowTemplates(search, nextStatus);
      setTemplates(result.templates);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载工作流模板失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(query, status), 250);
    return () => window.clearTimeout(timer);
  }, [load, query, status]);

  const categories = useMemo(
    () => new Set(templates.map((template) => template.category)).size,
    [templates],
  );

  async function createTemplate() {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await adminApi.createWorkflowTemplate({
        name: "未命名模板",
        description: "",
        category: "其他",
        tags: [],
        schemaVersion: 1,
        graph: createStarterWorkflow(),
        isFeatured: false,
        sortOrder: 0,
      });
      router.push(`/admin/workflows/${encodeURIComponent(created.id)}/edit?source=template`);
    } catch (reason) {
      setError(apiErrorMessage(reason, "新建模板失败"));
    } finally {
      setCreating(false);
    }
  }

  async function openTemplate(template: WorkflowTemplateSummary) {
    if (template.status !== "published") {
      router.push(`/admin/workflows/${encodeURIComponent(template.id)}/edit?source=template`);
      return;
    }
    setPendingId(template.id);
    setError(null);
    try {
      const document = await adminApi.getWorkflowTemplate(template.id);
      setEditorError(null);
      setEditor(toEditor(document));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "读取模板失败");
    } finally {
      setPendingId(null);
    }
  }

  async function createApi(template: WorkflowTemplateSummary) {
    setPendingId(template.id);
    setError(null);
    try {
      const source = await adminApi.getWorkflowTemplate(template.id);
      if (!source.graph) throw new Error("模板缺少工作流定义");
      setCopySource({
        name: (source.name + " 副本").slice(0, 200),
        graph: copyTemplateGraphForApi(source.graph),
        copyOrigin: { source: "template", id: source.id },
      });
    } catch (reason) {
      setError(apiErrorMessage(reason, "读取复制来源失败"));
    } finally {
      setPendingId(null);
    }
  }

  async function saveTemplate() {
    if (!editor || editor.status === "published") return;
    if (!editor.name.trim()) {
      setEditorError("请输入模板名称");
      return;
    }

    setSaving(true);
    setEditorError(null);
    try {
      const input: WorkflowTemplateInput = {
        name: editor.name.trim(),
        description: editor.description.trim(),
        category: editor.category.trim() || "其他",
        tags: editor.tags
          .split(/[,，]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
        schemaVersion: 1,
        graph: editor.graph,
        isFeatured: editor.isFeatured,
        sortOrder: editor.sortOrder,
      };
      if (editor.id) {
        await adminApi.updateWorkflowTemplate(editor.id, input);
      } else {
        await adminApi.createWorkflowTemplate(input);
      }
      setEditor(null);
      await load(query, status);
    } catch (reason) {
      setEditorError(apiErrorMessage(reason, "保存模板失败"));
    } finally {
      setSaving(false);
    }
  }

  async function importFile(file: File) {
    if (!editor || editor.status === "published") return;
    setEditorError(null);
    const result = importWorkflow(await file.text());
    if (!result.ok) {
      setEditorError(`导入失败：${result.detail}`);
      return;
    }

    setEditor((current) =>
      current
        ? {
            ...current,
            name: current.name.trim() ? current.name : result.name,
            graph: result.graph,
            sourceFileName: file.name,
          }
        : current,
    );
  }

  async function mutate(template: WorkflowTemplateSummary, action: () => Promise<unknown>) {
    setPendingId(template.id);
    setError(null);
    try {
      await action();
      await load(query, status);
    } catch (reason) {
      setError(apiErrorMessage(reason, "操作模板失败"));
    } finally {
      setPendingId(null);
    }
  }

  const columns: PrimaryTableCol<WorkflowTemplateSummary>[] = [
    {
      colKey: "name",
      title: "模板",
      minWidth: 260,
      cell: ({ row }) => (
        <div className="min-w-0 py-1">
          <div className="flex items-center gap-2">
            <button
              className="truncate text-sm font-medium text-primary hover:underline"
              onClick={() =>
                router.push(
                  `/admin/workflows/${row.id}/edit?source=template&returnTo=${encodeURIComponent("/admin/workflows?source=template")}`,
                )
              }
            >
              {row.name}
            </button>
            {row.isFeatured && (
              <Tag theme="primary" variant="light">
                推荐
              </Tag>
            )}
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-[var(--td-text-color-secondary)]">
            {row.description || "暂无描述"}
          </p>
        </div>
      ),
    },
    {
      colKey: "category",
      title: "分类",
      width: 130,
      cell: ({ row }) => <Tag variant="outline">{row.category}</Tag>,
    },
    {
      colKey: "status",
      title: "状态",
      width: 110,
      cell: ({ row }) => <StatusTag status={row.status} />,
    },
    {
      colKey: "nodeCount",
      title: "结构",
      width: 160,
      cell: ({ row }) => (
        <div className="text-xs leading-5">
          <p>{row.nodeCount} 个节点</p>
          <p className="text-[var(--td-text-color-placeholder)]">
            文本 {row.textInputCount} · 图片 {row.imageInputCount}
          </p>
        </div>
      ),
    },
    {
      colKey: "useCount",
      title: "使用次数",
      width: 100,
      align: "right",
    },
    {
      colKey: "updatedAt",
      title: "更新时间",
      width: 170,
      cell: ({ row }) => dateFormatter.format(new Date(row.updatedAt)),
    },
    {
      colKey: "operation",
      title: "操作",
      width: 200,
      fixed: "right",
      cell: ({ row }) => (
        <div className="flex flex-wrap justify-end gap-1">
          <Button
            size="small"
            variant="text"
            loading={pendingId === row.id}
            icon={<Pencil size={14} aria-hidden />}
            onClick={() => void openTemplate(row)}
          >
            {row.status === "published" ? "查看" : "画布编辑"}
          </Button>
          {row.status === "published" ? (
            <Button
              size="small"
              variant="text"
              disabled={pendingId !== null}
              onClick={() => {
                if (window.confirm("确认下架模板？前台将不再展示，已创建的工作流不受影响。"))
                  void mutate(row, () => adminApi.archiveWorkflowTemplate(row.id));
              }}
            >
              下架模板
            </Button>
          ) : (
            <Button
              size="small"
              variant="text"
              disabled={pendingId !== null}
              onClick={() => router.push(`/admin/workflows/${row.id}/publications?source=template`)}
            >
              发布
            </Button>
          )}
          <MenuTrigger>
            <MenuButton
              className="inline-flex size-8 items-center justify-center rounded hover:bg-muted"
              isDisabled={pendingId !== null}
              aria-label={`${row.name} 更多操作`}
            >
              <MoreHorizontal size={16} />
            </MenuButton>
            <Popover className="z-50 rounded-lg border bg-popover p-1 shadow-panel">
              <Menu
                aria-label="模板操作"
                className="outline-none"
                onAction={(key) => {
                  if (key === "fork") void createApi(row);
                  else if (
                    key === "duplicate" &&
                    window.confirm("复制成独立的历史模板草稿？原模板保持不变。")
                  )
                    void mutate(row, () => adminApi.duplicateWorkflowTemplate(row.id));
                  else if (key === "delete") setPendingDelete(row);
                }}
              >
                <MenuItem
                  id="fork"
                  className="cursor-pointer rounded px-3 py-2 text-sm outline-none data-focused:bg-accent"
                >
                  复制为新工作流
                </MenuItem>
                <MenuItem
                  id="duplicate"
                  className="cursor-pointer rounded px-3 py-2 text-sm outline-none data-focused:bg-accent"
                >
                  复制历史模板草稿
                </MenuItem>
                {row.status !== "published" && (
                  <MenuItem
                    id="delete"
                    className="cursor-pointer rounded border-t px-3 py-2 text-sm text-destructive outline-none data-focused:bg-accent"
                  >
                    删除模板
                  </MenuItem>
                )}
              </Menu>
            </Popover>
          </MenuTrigger>
        </div>
      ),
    },
  ];

  return (
    <section className="sol-admin-panel" aria-label="模板运营">
      <header className="sol-admin-panel-header">
        <div>
          <h2 className="text-base font-semibold">模板运营</h2>
          <p className="mt-1 text-sm text-[var(--td-text-color-secondary)]">
            当前返回 {templates.length} 个历史模板 · {categories} 个分类；上架后在前台模板库展示。
          </p>
        </div>
        <Button
          theme="primary"
          icon={<Plus size={16} aria-hidden />}
          loading={creating}
          onClick={() => void createTemplate()}
        >
          新建模板
        </Button>
      </header>

      <div className="sol-admin-template-filters">
        <label>
          <span className="sr-only">搜索模板</span>
          <Input
            value={query}
            prefixIcon={<Search size={16} aria-hidden />}
            placeholder="搜索名称、描述或标签"
            clearable
            onChange={(value) => setQuery(String(value))}
          />
        </label>
        <label>
          <span className="sr-only">模板状态</span>
          <Select
            value={status}
            options={[
              { value: "", label: "全部状态" },
              { value: "draft", label: "草稿" },
              { value: "published", label: "已发布" },
              { value: "archived", label: "已下架" },
            ]}
            onChange={(value) => setStatus(value as WorkflowTemplateStatus | "")}
          />
        </label>
      </div>

      <div className="sol-admin-panel-scroll">
        {error && (
          <Alert
            className="mb-4"
            theme="error"
            message={error}
            operation={
              <Button size="small" variant="text" onClick={() => void load(query, status)}>
                重试
              </Button>
            }
          />
        )}

        <PrimaryTable
          rowKey="id"
          data={templates}
          columns={columns}
          loading={loading}
          hover
          disableDataPage
          tableLayout="fixed"
          resizable
          empty="暂无工作流模板"
        />
      </div>

      <Dialog
        visible={editor !== null}
        width={720}
        placement="center"
        header={
          editor?.id ? (editor.status === "published" ? "查看模板" : "编辑模板") : "新建工作流模板"
        }
        confirmBtn={editor?.status === "published" ? null : "保存草稿"}
        cancelBtn={editor?.status === "published" ? "关闭" : "取消"}
        confirmLoading={saving}
        closeOnOverlayClick={!saving}
        destroyOnClose
        onConfirm={() => void saveTemplate()}
        onClose={() => !saving && setEditor(null)}
        onCancel={() => !saving && setEditor(null)}
      >
        {editor && (
          <TemplateForm
            editor={editor}
            error={editorError}
            onChange={setEditor}
            onImport={(file) => void importFile(file)}
          />
        )}
      </Dialog>

      {pendingDelete && (
        <DeleteWorkflowDialog
          target={{ id: pendingDelete.id, name: pendingDelete.name, source: "template" }}
          onClose={() => setPendingDelete(null)}
          onNavigate={(section) =>
            router.push(`/admin/workflows/${pendingDelete.id}/${section}?source=template`)
          }
          onDeleted={() => {
            setPendingDelete(null);
            void load(query, status);
          }}
        />
      )}
      {copySource && (
        <CreateWorkflowDialog
          initial={copySource}
          enabled={false}
          onClose={() => setCopySource(undefined)}
          onCreated={(id) => {
            setCopySource(undefined);
            router.push(`/admin/workflows/${id}/edit?source=workflow`);
          }}
        />
      )}
    </section>
  );
}

function TemplateForm({
  editor,
  error,
  onChange,
  onImport,
}: {
  editor: TemplateEditor;
  error: string | null;
  onChange: (editor: TemplateEditor) => void;
  onImport: (file: File) => void;
}) {
  const readonly = editor.status === "published";
  const nodeTypes = editor.graph.nodes.reduce<Record<string, number>>((counts, node) => {
    const type = String(node.type ?? "unknown");
    counts[type] = (counts[type] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
      {readonly && (
        <Alert theme="info" message="已发布模板不可直接修改。请先下架后编辑，或复制为新草稿。" />
      )}
      {error && <Alert theme="error" message={error} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="模板名称" required>
          <Input
            value={editor.name}
            maxlength={200}
            disabled={readonly}
            onChange={(value) => onChange({ ...editor, name: String(value) })}
          />
        </Field>
        <Field label="分类">
          <Input
            value={editor.category}
            maxlength={80}
            disabled={readonly}
            placeholder="例如：电商、社媒、视频"
            onChange={(value) => onChange({ ...editor, category: String(value) })}
          />
        </Field>
      </div>

      <Field label="模板描述">
        <textarea
          className="min-h-24 w-full resize-y rounded-md border border-[var(--td-component-border)] bg-[var(--td-bg-color-container)] px-3 py-2 text-sm outline-none focus:border-[var(--td-brand-color)] disabled:opacity-60"
          value={editor.description}
          maxLength={2000}
          disabled={readonly}
          placeholder="说明模板适合什么场景，以及用户需要替换哪些输入。"
          onChange={(event) => onChange({ ...editor, description: event.target.value })}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <Field label="标签">
          <Input
            value={editor.tags}
            disabled={readonly}
            placeholder="用逗号分隔，最多 10 个"
            onChange={(value) => onChange({ ...editor, tags: String(value) })}
          />
        </Field>
        <Field label="排序权重">
          <input
            type="number"
            className="h-8 w-full rounded-md border border-[var(--td-component-border)] bg-[var(--td-bg-color-container)] px-3 text-sm outline-none focus:border-[var(--td-brand-color)] disabled:opacity-60"
            min={-100000}
            max={100000}
            value={editor.sortOrder}
            disabled={readonly}
            onChange={(event) =>
              onChange({ ...editor, sortOrder: Number(event.target.value) || 0 })
            }
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={editor.isFeatured}
          disabled={readonly}
          onChange={(event) => onChange({ ...editor, isFeatured: event.target.checked })}
        />
        前台推荐展示
      </label>

      <div className="rounded-lg border border-[var(--td-component-stroke)] bg-[var(--td-bg-color-secondarycontainer)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">工作流定义</p>
            <p className="mt-1 text-xs text-[var(--td-text-color-secondary)]">
              {editor.graph.nodes.length} 个节点 · {editor.graph.edges.length} 条连线
              {editor.sourceFileName ? ` · ${editor.sourceFileName}` : ""}
            </p>
          </div>
          {!readonly && (
            <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-[var(--td-component-border)] bg-[var(--td-bg-color-container)] px-3 text-sm hover:bg-[var(--td-bg-color-container-hover)]">
              <FileUp size={15} aria-hidden />
              导入工作流文件
              <input
                type="file"
                className="sr-only"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onImport(file);
                  event.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(nodeTypes).map(([type, count]) => (
            <Tag key={type} variant="light">
              {nodeTypeName(type)} × {count}
            </Tag>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function StatusTag({ status }: { status: WorkflowTemplateStatus }) {
  const config =
    status === "published"
      ? { label: "已发布", theme: "success" as const }
      : status === "archived"
        ? { label: "已下架", theme: "warning" as const }
        : { label: "草稿", theme: "default" as const };
  return (
    <Tag theme={config.theme} variant="light">
      {config.label}
    </Tag>
  );
}

function toEditor(document: WorkflowTemplateDocument): TemplateEditor {
  return {
    id: document.id,
    status: document.status,
    name: document.name,
    description: document.description,
    category: document.category,
    tags: document.tags.join(", "),
    graph: document.graph ?? { nodes: [], edges: [] },
    isFeatured: document.isFeatured,
    sortOrder: document.sortOrder,
    sourceFileName: null,
  };
}

function apiErrorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof adminApi.AdminApiError && reason.details.length > 0) {
    return reason.details.join("；");
  }
  return reason instanceof Error ? reason.message : fallback;
}

function nodeTypeName(type: string): string {
  return (
    (
      {
        text: "文本输入",
        image: "图片输入",
        imageGenerate: "图片生成",
        videoGenerate: "视频生成",
        videoExtend: "视频延长",
        videoFrame: "提取视频尾帧",
        imageOutput: "图片结果",
        videoOutput: "视频结果",
        output: "结果输出",
      } as Record<string, string>
    )[type] ?? type
  );
}
