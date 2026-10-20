"use client";

import { ChevronDown, Home, Library, Loader2, Pencil, Plus, Trash2, Workflow } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import * as canvasApi from "@/features/canvas/api";
import { rememberCurrentCanvas } from "@/features/canvas/sync";
import { CreateProjectDialog } from "@/features/projects/create-project-dialog";
import * as workflowApi from "@/features/workflow/api";
import { WorkflowTemplateLibraryDialog } from "@/features/workflow/template-library-dialog";
import { cn } from "@/lib/utils";

export function WorkflowProjectMenu({
  current,
  onCurrentChange,
}: {
  current: workflowApi.WorkflowDocument;
  onCurrentChange: (document: workflowApi.WorkflowDocument) => void;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [workflows, setWorkflows] = useState<workflowApi.WorkflowSummary[]>([]);
  const [canvasNames, setCanvasNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<workflowApi.WorkflowSummary | null>(null);
  const editing = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void Promise.all([workflowApi.listWorkflows(), canvasApi.listCanvases()])
      .then(([workflowResult, canvasResult]) => {
        setWorkflows(workflowResult.workflows);
        setCanvasNames(canvasResult.canvases.map((canvas) => canvas.name));
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : t("errors.unknown"));
      })
      .finally(() => setLoading(false));
  }, [open, t]);

  async function rename(id: string) {
    if (editing.current !== id) return;
    editing.current = null;
    const name = draftName.trim();
    setRenamingId(null);
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await workflowApi.renameWorkflow(id, name);
      setWorkflows((items) =>
        items.map((item) =>
          item.id === id ? { ...item, name: updated.name, updatedAt: updated.updatedAt } : item,
        ),
      );
      if (id === current.id) onCurrentChange(updated);
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : t("errors.unknown"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(project: workflowApi.WorkflowSummary) {
    setBusy(true);
    setError(null);
    try {
      await workflowApi.deleteWorkflow(project.id);
      const remaining = workflows.filter((item) => item.id !== project.id);
      setWorkflows(remaining);
      setPendingDelete(null);
      if (project.id === current.id) {
        router.push(remaining[0] ? `/workflow/${remaining[0].id}` : "/");
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t("errors.unknown"));
      setPendingDelete(null);
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="relative min-w-0 flex-1 sm:flex-none">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-full min-w-0 max-w-64 justify-start gap-2 px-2 sm:w-auto"
          aria-expanded={open}
          onPress={() => {
            if (!open) setLoading(true);
            setOpen(!open);
          }}
        >
          <Workflow className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate text-xs font-medium">{current.name}</span>
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" aria-hidden />
        </Button>

        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            <div
              aria-busy={busy}
              className="absolute top-full left-0 z-30 mt-1 w-[min(18rem,calc(100vw-2rem))] rounded-xl border bg-popover p-1 shadow-xl"
            >
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-accent"
              >
                <Home className="size-3.5 text-muted-foreground" aria-hidden />
                {t("workflow.backToCanvas")}
              </button>
              <div className="my-1 h-px bg-border" />
              <p className="px-2 py-1 text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
                {t("workflow.projects")}
              </p>
              <div className="max-h-64 overflow-y-auto">
                {loading && (
                  <Loader2 className="mx-auto my-3 size-4 animate-spin text-muted-foreground" />
                )}
                {workflows.map((workflow) =>
                  renamingId === workflow.id ? (
                    <div key={workflow.id} className="p-1">
                      <Input
                        autoFocus
                        value={draftName}
                        className="h-7 text-xs"
                        onChange={(event) => setDraftName(event.target.value)}
                        onBlur={() => void rename(workflow.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void rename(workflow.id);
                          if (event.key === "Escape") {
                            editing.current = null;
                            setRenamingId(null);
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      key={workflow.id}
                      className={cn(
                        "group flex items-center rounded-lg pr-1 hover:bg-accent",
                        workflow.id === current.id && "bg-accent/60",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          if (workflow.id !== current.id) router.push(`/workflow/${workflow.id}`);
                        }}
                        className="min-w-0 flex-1 px-2 py-2 text-left"
                      >
                        <span className="block truncate text-xs">{workflow.name}</span>
                        <span className="text-[0.625rem] text-muted-foreground">
                          {t("workflow.nodeCount", { count: workflow.nodeCount })}
                        </span>
                      </button>
                      <ProjectAction
                        icon={Pencil}
                        label={t("canvas.projectRename")}
                        onClick={() => {
                          setDraftName(workflow.name);
                          editing.current = workflow.id;
                          setRenamingId(workflow.id);
                        }}
                      />
                      <ProjectAction
                        icon={Trash2}
                        label={t("canvas.projectDelete")}
                        destructive
                        onClick={() => {
                          setOpen(false);
                          setPendingDelete(workflow);
                        }}
                      />
                    </div>
                  ),
                )}
              </div>
              {error && <p className="px-2 py-1 text-[0.625rem] text-destructive">{error}</p>}
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setCreating(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-accent"
              >
                <Plus className="size-3.5 text-muted-foreground" aria-hidden />
                {t("canvas.newProject")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setTemplatesOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-accent"
              >
                <Library className="size-3.5 text-muted-foreground" aria-hidden />
                {t("workflow.templateLibrary")}
              </button>
            </div>
          </>
        )}
      </div>

      <CreateProjectDialog
        isOpen={creating}
        onOpenChange={setCreating}
        canvasNames={canvasNames}
        workflowNames={workflows.map((workflow) => workflow.name)}
        onCanvasCreated={(created) => {
          rememberCurrentCanvas(created.id);
          router.push("/");
        }}
        onWorkflowCreated={(created) => {
          setWorkflows((items) => [workflowApi.summarize(created), ...items]);
          router.push(`/workflow/${created.id}`);
        }}
      />
      <WorkflowTemplateLibraryDialog
        isOpen={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onCreated={(created) => {
          setWorkflows((items) => [workflowApi.summarize(created), ...items]);
          router.push(`/workflow/${created.id}`);
        }}
      />
      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        title={t("canvas.projectDelete")}
        description={
          pendingDelete ? t("workflow.deleteConfirm", { name: pendingDelete.name }) : undefined
        }
        onConfirm={() => (pendingDelete ? remove(pendingDelete) : undefined)}
      />
    </>
  );
}

function ProjectAction({
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
      className={cn(
        "rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        destructive && "hover:text-destructive",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
    </button>
  );
}
