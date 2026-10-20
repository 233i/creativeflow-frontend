"use client";

import { LayoutGrid, Library, Loader2, Workflow } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import * as canvasApi from "@/features/canvas/api";
import { createStarterWorkflow } from "@/features/workflow/template";
import * as workflowApi from "@/features/workflow/api";
import { WorkflowTemplateLibraryDialog } from "@/features/workflow/template-library-dialog";
import { cn } from "@/lib/utils";
import { createV2Workflow } from "@/features/workflow/v2/types";

type ProjectKind = "canvas" | "workflow" | "ai-workflow";

export function CreateProjectDialog({
  isOpen,
  onOpenChange,
  canvasNames = [],
  workflowNames = [],
  onCanvasCreated,
  onWorkflowCreated,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  canvasNames?: string[];
  workflowNames?: string[];
  onCanvasCreated: (document: canvasApi.CanvasDocument) => void;
  onWorkflowCreated: (document: workflowApi.WorkflowDocument) => void;
}) {
  const t = useT();
  const [kind, setKind] = useState<ProjectKind>("canvas");
  const [workflowEnabled, setWorkflowEnabled] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const value = await workflowApi.getWorkflowCapabilities();
        if (!cancelled) setWorkflowEnabled(value.enabled);
      } catch {
        if (!cancelled) setWorkflowEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);
  const [name, setName] = useState(() => nextName(canvasNames, t("canvas.defaultProject")));
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const suggestedName =
    kind === "canvas"
      ? nextName(canvasNames, t("canvas.defaultProject"))
      : nextName(
          workflowNames,
          kind === "ai-workflow" ? "AI 工作流" : t("workflow.defaultProject"),
        );
  const currentName = edited ? name : suggestedName;

  function changeOpen(open: boolean) {
    if (!open) {
      setKind("canvas");
      setName("");
      setEdited(false);
      setError(null);
    }
    onOpenChange(open);
  }

  function choose(next: ProjectKind) {
    setKind(next);
  }

  async function create() {
    const normalized = currentName.trim();
    if (!normalized || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "canvas") {
        onCanvasCreated(await canvasApi.createCanvas(normalized));
      } else {
        onWorkflowCreated(
          await workflowApi.createWorkflow(
            normalized,
            kind === "ai-workflow" ? createV2Workflow() : createStarterWorkflow(),
          ),
        );
      }
      changeOpen(false);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t("errors.unknown"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog isOpen={isOpen} onOpenChange={changeOpen} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("projects.createTitle")}</DialogTitle>
          <DialogDescription>{t("projects.createDescription")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <ModeCard
            selected={kind === "canvas"}
            icon={<LayoutGrid className="size-5" />}
            title={t("projects.canvasTitle")}
            description={t("projects.canvasDescription")}
            onClick={() => choose("canvas")}
          />
          <ModeCard
            selected={kind === "workflow"}
            icon={<Workflow className="size-5" />}
            title={t("projects.workflowTitle")}
            description={t("projects.workflowDescription")}
            onClick={() => choose("workflow")}
          />
        </div>

        {workflowEnabled && (
          <ModeCard
            selected={kind === "ai-workflow"}
            icon={<Workflow className="size-5" />}
            title="AI 工作流"
            description="开始 → LLM → 结束。定义输入参数，连接变量，运行并查看文本或结构化字段。"
            onClick={() => choose("ai-workflow")}
          />
        )}

        <label className="flex flex-col gap-1.5 text-xs font-medium">
          {t("projects.name")}
          <Input
            autoFocus
            value={currentName}
            onChange={(event) => {
              setEdited(true);
              setName(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") void create();
            }}
          />
        </label>

        {kind === "workflow" && (
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              setTemplatesOpen(true);
            }}
            className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10"
          >
            <span className="rounded-lg bg-primary/10 p-2 text-primary">
              <Library className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{t("workflow.browseTemplates")}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t("workflow.templateLibraryDescription")}
              </span>
            </span>
          </button>
        )}

        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onPress={() => changeOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button isDisabled={!currentName.trim() || busy} onPress={() => void create()}>
            {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {kind === "workflow" ? t("workflow.createBlank") : t("projects.create")}
          </Button>
        </DialogFooter>
      </Dialog>

      <WorkflowTemplateLibraryDialog
        isOpen={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onCreated={(document) => {
          onWorkflowCreated(document);
          setTemplatesOpen(false);
        }}
      />
    </>
  );
}

function ModeCard({
  selected,
  icon,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-32 flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors",
        selected ? "border-primary bg-primary/5 ring-2 ring-primary/15" : "hover:bg-muted/60",
      )}
    >
      <span
        className={cn(
          "rounded-lg p-2",
          selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs leading-5 text-muted-foreground">{description}</span>
    </button>
  );
}

function nextName(names: string[], base: string): string {
  const taken = new Set(names);
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}
