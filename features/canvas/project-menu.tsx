"use client";

import {
  Check,
  ChevronDown,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Workflow,
} from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import * as api from "@/features/canvas/api";
import { clearLocal } from "@/features/canvas/persistence";
import { CreateProjectDialog } from "@/features/projects/create-project-dialog";
import * as workflowApi from "@/features/workflow/api";
import { cn } from "@/lib/utils";

/**
 * 切换此设备上的项目，并支持创建、重命名和删除。
 *
 * 服务器从一开始就支持每个设备拥有多个画布，但界面没有入口：页面只会打开偶然解析到的画布，
 * 且无法离开，因此 `renameCanvas` 和 `deleteCanvas` 完全没有调用点。此组件补上了该界面。
 *
 * 列表由调用方拥有，而不是在此获取，因为页面启动时已加载列表以决定打开内容；
 * 挂载时重新获取会重复请求，还可能让两个副本不一致。菜单打开时刷新列表，
 * 这是用户唯一可操作它的时刻，而且成本很低：端点在 SQL 中统计节点，从不传输图正文。
 */
export function ProjectMenu({
  currentId,
  projects,
  onProjectsChange,
  onSwitch,
}: {
  currentId: string;
  projects: api.CanvasSummary[];
  /** 必须保持引用稳定，因为它会驱动刷新副作用；应传入状态设置函数。 */
  onProjectsChange: Dispatch<SetStateAction<api.CanvasSummary[]>>;
  onSwitch: (id: string) => void;
}) {
  const t = useT();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<api.CanvasSummary | null>(null);
  const [workflowProjects, setWorkflowProjects] = useState<workflowApi.WorkflowSummary[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  // 记录重命名字段所属数据行，由最先提交或放弃的处理器认领。Enter 和 Escape 都会卸载字段，
  // 而卸载有焦点的输入会触发失焦；若无认领机制，失焦处理器会再次运行，
  // 重复发送已提交的重命名，或恢复用户刚放弃的操作。
  const editing = useRef<string | null>(null);

  const current = projects.find((project) => project.id === currentId);

  // 启动后其他标签页可能新增或重命名内容。此处失败保持静默：屏幕上的现有列表仍可使用，
  // 为只过期几秒的列表显示错误横幅，反而比短暂过期更糟。
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void (async () => {
      try {
        const [canvasResult, workflowResult] = await Promise.allSettled([
          api.listCanvases(),
          workflowApi.listWorkflows(),
        ]);
        if (!cancelled && canvasResult.status === "fulfilled") {
          onProjectsChange(canvasResult.value.canvases);
        }
        if (!cancelled && workflowResult.status === "fulfilled") {
          setWorkflowProjects(workflowResult.value.workflows);
        }
      } catch {
        // 保留现有内容。
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, onProjectsChange]);

  /** 执行修改，并在菜单中显示失败，而不是把异常抛入渲染树。 */
  async function run<T>(action: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    setError(null);

    try {
      return await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("errors.unknown"));
      return null;
    } finally {
      setBusy(false);
    }
  }

  function beginRename(project: api.CanvasSummary) {
    editing.current = project.id;
    setDraftName(project.name);
    setRenamingId(project.id);
  }

  function abandonRename() {
    editing.current = null;
    setRenamingId(null);
  }

  async function commitRename(id: string) {
    if (editing.current !== id) return;
    editing.current = null;

    const name = draftName.trim();
    setRenamingId(null);

    // 空字段表示“取消操作”，而不是“清除名称”；服务器无论如何都会替换为自己的占位名称。
    if (!name || name === projects.find((project) => project.id === id)?.name) return;

    const updated = await run(() => api.renameCanvas(id, name));
    if (!updated) return;

    onProjectsChange((list) =>
      list.map((project) => (project.id === id ? { ...project, name: updated.name } : project)),
    );
  }

  async function remove(project: api.CanvasSummary) {
    const remaining = await run(async () => {
      await api.deleteCanvas(project.id);

      const left = projects.filter((candidate) => candidate.id !== project.id);
      if (left.length > 0) return left;

      // 删除最后一个项目会让页面没有可打开内容，而创建替代项目的启动逻辑只会在加载时运行。
      return [api.summarize(await api.createCanvas(t("canvas.defaultProject")))];
    });

    if (!remaining) return;

    // 否则缓存副本会比服务器记录存续更久，把已删除的图一直留在 localStorage，直到浏览器存储被清除。
    clearLocal(project.id);
    onProjectsChange(remaining);

    if (project.id === currentId) onSwitch(remaining[0].id);
  }

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="ghost"
        className="h-9 w-full justify-start gap-2 px-2"
        aria-expanded={open}
        aria-haspopup="menu"
        onPress={() => setOpen((value) => !value)}
      >
        <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left text-sm">
          {current?.name ?? t("canvas.untitled")}
        </span>
        <ChevronDown className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      </Button>

      {open && (
        <>
          {/* 点击外部关闭层。位于画布上方，使外部点击关闭菜单，而不会落到下方图上。 */}
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />

          <div className="canvas-menu absolute top-full left-0 z-30 mt-1 flex w-64 flex-col rounded-lg border bg-popover p-1 shadow-lg">
            <div className="max-h-72 overflow-y-auto">
              {projects.map((project) =>
                renamingId === project.id ? (
                  <div key={project.id} className="p-1">
                    <Input
                      autoFocus
                      aria-label={t("canvas.projectNamePlaceholder")}
                      placeholder={t("canvas.projectNamePlaceholder")}
                      value={draftName}
                      className="h-7 text-xs"
                      onChange={(event) => setDraftName(event.target.value)}
                      onBlur={() => void commitRename(project.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void commitRename(project.id);
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          abandonRename();
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div
                    key={project.id}
                    className={cn(
                      "group flex items-center rounded-md pr-1 hover:bg-accent",
                      project.id === currentId && "bg-accent/60",
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                      onClick={() => {
                        setOpen(false);
                        if (project.id !== currentId) onSwitch(project.id);
                      }}
                    >
                      <Check
                        className={cn(
                          "size-3.5 shrink-0",
                          project.id === currentId ? "text-foreground" : "invisible",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs">{project.name}</span>
                        <span className="block text-[0.6875rem] text-muted-foreground">
                          {t("canvas.projectNodes", { count: project.nodeCount })}
                        </span>
                      </span>
                    </button>

                    <RowAction
                      icon={Pencil}
                      label={t("canvas.projectRename")}
                      onClick={() => beginRename(project)}
                    />
                    <RowAction
                      icon={Trash2}
                      label={t("canvas.projectDelete")}
                      destructive
                      onClick={() => {
                        // 先关闭菜单，防止外部点击层覆盖对话框。
                        setOpen(false);
                        setPendingDelete(project);
                      }}
                    />
                  </div>
                ),
              )}

              {workflowProjects.length > 0 && (
                <>
                  <div className="mx-2 my-1 h-px bg-border" />
                  <p className="px-2 py-1 text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("workflow.projects")}
                  </p>
                  {workflowProjects.map((workflow) => (
                    <button
                      key={workflow.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                      onClick={() => window.location.assign(`/workflow/${workflow.id}`)}
                    >
                      <Workflow className="size-3.5 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs">{workflow.name}</span>
                        <span className="block text-[0.6875rem] text-muted-foreground">
                          {t("workflow.nodeCount", { count: workflow.nodeCount })}
                        </span>
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>

            {error && (
              <p className="px-2 py-1 text-[0.6875rem] text-destructive" role="alert">
                {error}
              </p>
            )}

            <div className="my-1 h-px bg-border" />

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
              ) : (
                <Plus className="size-3.5 text-muted-foreground" aria-hidden />
              )}
              {t("canvas.newProject")}
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onOpenChange={(isOpen) => !isOpen && setPendingDelete(null)}
        title={t("canvas.projectDelete")}
        description={
          pendingDelete ? t("canvas.projectDeleteConfirm", { name: pendingDelete.name }) : undefined
        }
        onConfirm={() => (pendingDelete ? remove(pendingDelete) : undefined)}
      />

      <CreateProjectDialog
        isOpen={createOpen}
        onOpenChange={setCreateOpen}
        canvasNames={projects.map((project) => project.name)}
        workflowNames={workflowProjects.map((project) => project.name)}
        onCanvasCreated={(created) => {
          onProjectsChange((list) => [api.summarize(created), ...list]);
          onSwitch(created.id);
        }}
        onWorkflowCreated={(created) => {
          setWorkflowProjects((list) => [workflowApi.summarize(created), ...list]);
          window.location.assign(`/workflow/${created.id}`);
        }}
      />
    </div>
  );
}

function RowAction({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      // 只有悬停数据行或通过键盘聚焦按钮时才显示，使列表看起来是名称列表而不是图标网格。
      className={cn(
        "rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background focus-visible:opacity-100 group-hover:opacity-100",
        destructive && "hover:text-destructive",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
    </button>
  );
}
