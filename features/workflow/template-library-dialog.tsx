"use client";

import {
  ArrowRight,
  Image as ImageIcon,
  Layers3,
  Library,
  Loader2,
  Search,
  Sparkles,
  TextCursorInput,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { WorkflowDocument } from "@/features/workflow/api";
import * as templateApi from "@/features/workflow/templates-api";
import type { WorkflowGraph, WorkflowNode } from "@/features/workflow/types";
import { cn } from "@/lib/utils";

export function WorkflowTemplateLibraryDialog({
  isOpen,
  onOpenChange,
  onCreated,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (document: WorkflowDocument) => void;
}) {
  const t = useT();
  const [templates, setTemplates] = useState<templateApi.WorkflowTemplateSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [document, setDocument] = useState<templateApi.WorkflowTemplateDocument | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadFailedMessage = t("workflow.templateLoadFailed");

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void templateApi
      .listWorkflowTemplates()
      .then((result) => {
        if (cancelled) return;
        setTemplates(result.templates);
        setSelectedId((current) => current ?? result.templates[0]?.id ?? null);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : loadFailedMessage);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, loadFailedMessage]);

  const categories = useMemo(
    () => Array.from(new Set(templates.map((template) => template.category))).sort(),
    [templates],
  );
  const visibleTemplates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return templates.filter((template) => {
      if (category && template.category !== category) return false;
      if (!normalized) return true;
      return [template.name, template.description, template.category, ...template.tags].some(
        (value) => value.toLocaleLowerCase().includes(normalized),
      );
    });
  }, [category, query, templates]);
  const activeId =
    selectedId && visibleTemplates.some((template) => template.id === selectedId)
      ? selectedId
      : (visibleTemplates[0]?.id ?? null);
  const detailLoading = Boolean(activeId && document?.id !== activeId);
  const activeDocument = document?.id === activeId ? document : null;

  useEffect(() => {
    if (!isOpen || !activeId) return;
    let cancelled = false;
    void templateApi
      .getWorkflowTemplate(activeId)
      .then((result) => {
        if (cancelled) return;
        setDocument(result);
        setName(result.name);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : loadFailedMessage);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, isOpen, loadFailedMessage]);

  async function instantiate() {
    if (!activeDocument || creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await templateApi.instantiateWorkflowTemplate(activeDocument.id, name);
      onCreated(created);
      onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("workflow.templateCreateFailed"));
    } finally {
      setCreating(false);
    }
  }

  function changeOpen(open: boolean) {
    if (!open) {
      setQuery("");
      setCategory("");
      setSelectedId(null);
      setDocument(null);
      setError(null);
      setLoading(true);
    }
    onOpenChange(open);
  }

  const selectedSummary = templates.find((template) => template.id === activeId) ?? null;

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={changeOpen}
      className="h-[min(780px,calc(100dvh-2rem))] overflow-hidden p-0 sm:max-w-[min(1120px,calc(100vw-2rem))]"
    >
      <div className="grid min-h-0 grid-rows-[auto_1fr_auto]">
        <DialogHeader className="border-b px-6 py-5 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <Library className="size-4 text-primary" aria-hidden />
            {t("workflow.templateLibrary")}
          </DialogTitle>
          <DialogDescription>{t("workflow.templateLibraryDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col overflow-y-auto md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] md:overflow-hidden">
          <section className="flex min-h-0 flex-col border-b max-md:shrink-0 md:border-r md:border-b-0">
            <div className="space-y-3 border-b p-4">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  aria-label={t("workflow.templateSearch")}
                  className="pl-9"
                  value={query}
                  placeholder={t("workflow.templateSearch")}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <CategoryButton
                  selected={!category}
                  label={t("workflow.allCategories")}
                  onClick={() => setCategory("")}
                />
                {categories.map((value) => (
                  <CategoryButton
                    key={value}
                    selected={category === value}
                    label={value}
                    onClick={() => setCategory(value)}
                  />
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 max-md:h-64 max-md:flex-none">
              {loading ? (
                <div className="flex h-full min-h-40 items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  {t("common.loading")}
                </div>
              ) : visibleTemplates.length === 0 ? (
                <div className="flex h-full min-h-40 flex-col items-center justify-center px-6 text-center">
                  <Library className="mb-3 size-8 text-muted-foreground/60" aria-hidden />
                  <p className="font-medium">{t("workflow.templateEmpty")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("workflow.templateEmptyDescription")}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {visibleTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      selected={template.id === activeId}
                      onClick={() => {
                        setError(null);
                        setSelectedId(template.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="min-h-0 overflow-y-auto bg-muted/20 p-6 max-md:shrink-0 max-md:overflow-visible">
            {detailLoading ? (
              <div className="flex h-full min-h-48 items-center justify-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" aria-hidden />
              </div>
            ) : activeDocument && selectedSummary ? (
              <TemplateDetail document={activeDocument} summary={selectedSummary} />
            ) : (
              <div className="flex h-full min-h-48 flex-col items-center justify-center text-center text-muted-foreground">
                <Layers3 className="mb-3 size-8 opacity-60" aria-hidden />
                <p>{t("workflow.chooseTemplate")}</p>
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="mx-0 mb-0 grid grid-cols-2 items-end rounded-none px-5 py-3 sm:flex sm:items-end">
          <div className="col-span-2 mr-auto w-full min-w-0 flex-1 sm:max-w-sm">
            <label className="mb-1 block text-xs font-medium" htmlFor="template-workflow-name">
              {t("workflow.templateName")}
            </label>
            <Input
              id="template-workflow-name"
              value={name}
              disabled={!activeDocument || creating}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </div>
          <Button variant="outline" onPress={() => changeOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            isDisabled={!activeDocument || !name.trim() || creating}
            onPress={() => void instantiate()}
          >
            {creating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {creating ? t("workflow.usingTemplate") : t("workflow.useTemplate")}
          </Button>
        </DialogFooter>
        {error && (
          <p
            className="absolute right-5 bottom-16 max-w-md rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

function TemplateCard({
  template,
  selected,
  onClick,
}: {
  template: templateApi.WorkflowTemplateSummary;
  selected: boolean;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-48 flex-col rounded-xl border bg-card p-5 text-left transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-ring",
        selected ? "border-primary ring-2 ring-primary/15" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Badge variant="outline">{template.category}</Badge>
        {template.isFeatured && (
          <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-primary">
            <Sparkles className="size-3" aria-hidden />
            {t("workflow.featuredTemplate")}
          </span>
        )}
      </div>
      <h3 className="mt-3 line-clamp-1 text-sm font-semibold">{template.name}</h3>
      <p className="mt-1 line-clamp-2 flex-1 text-xs leading-5 text-muted-foreground">
        {template.description || t("workflow.templateNoDescription")}
      </p>
      <div className="mt-3 flex items-center gap-3 text-[0.6875rem] text-muted-foreground">
        <span>{t("workflow.nodeCount", { count: template.nodeCount })}</span>
        <span>{t("workflow.templateUses", { count: template.useCount })}</span>
        <ArrowRight className="ml-auto size-3.5" aria-hidden />
      </div>
    </button>
  );
}

function TemplateDetail({
  document,
  summary,
}: {
  document: templateApi.WorkflowTemplateDocument;
  summary: templateApi.WorkflowTemplateSummary;
}) {
  const t = useT();
  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{summary.category}</Badge>
          <span className="text-[0.6875rem] text-muted-foreground">v{summary.version}</span>
        </div>
        <h2 className="mt-3 text-lg font-semibold">{summary.name}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {summary.description || t("workflow.templateNoDescription")}
        </p>
        {summary.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {summary.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Metric icon={Layers3} value={summary.nodeCount} label={t("workflow.nodeLibrary")} />
        <Metric
          icon={TextCursorInput}
          value={summary.textInputCount}
          label={t("workflow.templateTextInputs")}
        />
        <Metric
          icon={ImageIcon}
          value={summary.imageInputCount}
          label={t("workflow.templateImageInputs")}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("workflow.templatePreview")}
        </p>
        <WorkflowGraphPreview graph={document.graph} />
      </div>

      <div className="rounded-lg border bg-background p-3 text-xs leading-5 text-muted-foreground">
        {t("workflow.templateCopyHint")}
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Layers3;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <Icon className="size-4 text-primary" aria-hidden />
      <p className="mt-2 text-lg font-semibold">{value}</p>
      <p className="mt-0.5 truncate text-[0.6875rem] text-muted-foreground">{label}</p>
    </div>
  );
}

function WorkflowGraphPreview({ graph }: { graph: WorkflowGraph | null }) {
  const t = useT();
  const nodes = (graph?.nodes ?? []).slice(0, 12);
  if (nodes.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-xl border bg-background text-xs text-muted-foreground">
        —
      </div>
    );
  }

  const points = normalizeNodePoints(nodes);
  const visibleIds = new Set(nodes.map((node) => node.id));
  return (
    <div className="relative h-52 overflow-hidden rounded-xl border bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-[size:18px_18px]">
      <svg className="absolute inset-0 size-full" aria-hidden>
        {(graph?.edges ?? [])
          .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
          .map((edge) => {
            const source = points.get(edge.source);
            const target = points.get(edge.target);
            return source && target ? (
              <line
                key={edge.id}
                x1={`${source.x}%`}
                y1={`${source.y}%`}
                x2={`${target.x}%`}
                y2={`${target.y}%`}
                stroke="var(--border)"
                strokeWidth="2"
              />
            ) : null;
          })}
      </svg>
      {nodes.map((node) => {
        const point = points.get(node.id)!;
        return (
          <div
            key={node.id}
            className="absolute flex min-w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border bg-card px-2 py-1.5 text-center text-[0.625rem] font-medium shadow-sm"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            {nodeTypeLabel(node, t)}
          </div>
        );
      })}
    </div>
  );
}

function normalizeNodePoints(nodes: WorkflowNode[]): Map<string, { x: number; y: number }> {
  const xs = nodes.map((node) => node.position.x);
  const ys = nodes.map((node) => node.position.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = Math.max(1, maxX - minX);
  const rangeY = Math.max(1, maxY - minY);
  return new Map(
    nodes.map((node) => [
      node.id,
      {
        x: 12 + ((node.position.x - minX) / rangeX) * 76,
        y: 18 + ((node.position.y - minY) / rangeY) * 64,
      },
    ]),
  );
}

function nodeTypeLabel(node: WorkflowNode, t: ReturnType<typeof useT>): string {
  const key = (
    {
      text: "workflow.nodeText",
      image: "workflow.nodeImage",
      imageGenerate: "workflow.nodeImageGenerate",
      videoGenerate: "workflow.nodeVideoGenerate",
      videoExtend: "workflow.nodeVideoExtend",
      videoFrame: "workflow.nodeVideoFrame",
      imageOutput: "workflow.nodeImageOutput",
      videoOutput: "workflow.nodeVideoOutput",
      output: "workflow.nodeOutput",
    } as Record<string, Parameters<typeof t>[0]>
  )[String(node.type)];
  return key ? t(key) : String(node.type);
}

function CategoryButton({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
