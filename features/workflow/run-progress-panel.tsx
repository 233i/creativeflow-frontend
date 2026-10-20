"use client";

import { useReactFlow } from "@xyflow/react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Loader2,
  MinusCircle,
  Play,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { elapsedSeconds, formatDuration } from "./v2/run-presentation";
import { useT, type Translate } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import type {
  WorkflowNodeRun,
  WorkflowNodeRunStatus,
  WorkflowPartialRerunPreview,
  WorkflowRun,
  WorkflowRunStatus,
} from "@/features/workflow/types";
import { WORKFLOW_NODE_SIZE } from "@/features/workflow/types";
import { cn } from "@/lib/utils";

type RunAction = "restart" | "resume" | "partial";

export interface WorkflowPartialRerunControls {
  selecting: boolean;
  preview: WorkflowPartialRerunPreview | null;
  previewPendingNodeId: string | null;
  error: string | null;
  onBegin: () => void;
  onChoose: (nodeId: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function WorkflowRunProgressPanel({
  run,
  actionPending,
  onResume,
  onRestart,
  partialRerun,
  embedded = false,
  onRefresh,
  onInspect,
}: {
  run: WorkflowRun;
  actionPending: RunAction | null;
  onResume: () => void;
  onRestart: () => void;
  partialRerun: WorkflowPartialRerunControls;
  embedded?: boolean;
  onRefresh?: () => void;
  onInspect?: (id: string) => void;
}) {
  const t = useT();
  const { getNode, getZoom, setCenter } = useReactFlow();
  const active = run.status === "queued" || run.status === "running";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!embedded || !active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [embedded, active]);
  const [collapsedRunId, setCollapsedRunId] = useState<string | null>(null);
  const [openedRunId, setOpenedRunId] = useState<string | null>(null);
  const selectingPartialRerun = run.status === "succeeded" && partialRerun.selecting;
  const partialPreview = selectingPartialRerun ? partialRerun.preview : null;
  const previewPendingNodeId = selectingPartialRerun ? partialRerun.previewPendingNodeId : null;
  const expanded = selectingPartialRerun
    ? true
    : active || run.status === "failed"
      ? collapsedRunId !== run.id
      : openedRunId === run.id;
  const previewRerunIds = useMemo(
    () => new Set(selectingPartialRerun ? (partialPreview?.rerunNodeIds ?? []) : []),
    [partialPreview, selectingPartialRerun],
  );
  const previewReusedIds = useMemo(
    () => new Set(selectingPartialRerun ? (partialPreview?.reusedNodeIds ?? []) : []),
    [partialPreview, selectingPartialRerun],
  );

  const progress = useMemo(() => overallProgress(run), [run]);
  const completed = run.nodes.filter((node) => isTerminalNode(node.status)).length;
  const current =
    run.nodes.find((node) => node.status === "running") ??
    run.nodes.find((node) => node.status === "queued") ??
    run.nodes.find((node) => node.status === "failed");
  const currentPosition = current
    ? run.nodes.findIndex((node) => node.nodeId === current.nodeId) + 1
    : completed;
  const positionLabel =
    active && current
      ? t("workflow.currentPosition", { current: currentPosition, total: run.nodes.length })
      : t("workflow.stepProgress", { completed, total: run.nodes.length });
  const summary =
    current && active
      ? t("workflow.currentStep", { name: nodeLabel(t, current) })
      : runStatusLabel(t, run.status);

  function focusNode(nodeRun: WorkflowNodeRun) {
    if (onInspect) {
      onInspect(nodeRun.nodeId);
      return;
    }
    const node = getNode(nodeRun.nodeId);
    if (!node) return;
    const fallback = WORKFLOW_NODE_SIZE[nodeRun.nodeType] ?? WORKFLOW_NODE_SIZE.text;
    const width = node.measured?.width ?? node.width ?? fallback.width;
    const height = node.measured?.height ?? node.height ?? fallback.height;
    const zoom = Math.min(1.1, Math.max(0.75, getZoom()));
    void setCenter(node.position.x + width / 2, node.position.y + height / 2, {
      duration: 300,
      zoom,
    });
  }

  if (embedded)
    return (
      <section aria-label="媒体运行详情" className="space-y-4 p-4 text-sm">
        <header className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{runStatusLabel(t, run.status)}</h2>
          <RunStatusIcon status={run.status} />
        </header>
        <p className="text-muted-foreground">
          已耗时{" "}
          {formatDuration(
            elapsedSeconds(run.createdAt, active ? null : (run.finishedAt ?? run.updatedAt), now),
          )}{" "}
          · 已结束 {completed} / {run.nodes.length}
        </p>
        <p className="break-all font-mono text-xs" tabIndex={0}>
          任务 {run.id}
        </p>
        <Button variant="outline" isDisabled={actionPending !== null} onPress={onRefresh}>
          重新查询
        </Button>
        <p className="rounded-lg bg-muted p-3 text-muted-foreground">
          关闭面板不取消任务。按节点显示实际状态；完成数量不是模型生成百分比。
        </p>
        {run.error && (
          <p role="alert" className="whitespace-pre-wrap break-words text-destructive">
            {run.error}
          </p>
        )}
        <ol className="space-y-2">
          {run.nodes.map((node, index) => (
            <li
              key={node.nodeId}
              className={`rounded-lg border p-3 ${node.status === "running" ? "border-primary bg-primary/5" : node.status === "failed" ? "border-destructive/40" : ""}`}
            >
              <div className="flex items-center gap-2">
                <StepStatusIcon status={node.status} />
                <strong className="min-w-0 flex-1">
                  {index + 1}. {nodeLabel(t, node)}
                </strong>
                <span className="shrink-0 text-xs">{nodeStatusLabel(t, node.status)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {node.startedAt
                  ? formatDuration(elapsedSeconds(node.startedAt, node.finishedAt, now))
                  : "等待执行"}
                {node.isReused ? " · 复用结果" : ""}
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="mt-1"
                onPress={() => {
                  if (selectingPartialRerun) partialRerun.onChoose(node.nodeId);
                  else focusNode(node);
                }}
              >
                {selectingPartialRerun ? "从此节点重跑" : "在历史图定位"}
              </Button>
              {node.error && (
                <p className="mt-2 whitespace-pre-wrap text-destructive">{node.error}</p>
              )}
              {node.output && (
                <details className="mt-2">
                  <summary className="cursor-pointer">输出摘要</summary>
                  <pre className="mt-2 whitespace-pre-wrap break-all text-xs">
                    {JSON.stringify(node.output, null, 2)}
                  </pre>
                </details>
              )}
              {previewRerunIds.has(node.nodeId) && <p className="text-amber-700">将重新执行</p>}
              {previewReusedIds.has(node.nodeId) && <p className="text-emerald-700">将复用结果</p>}
            </li>
          ))}
        </ol>
        {run.status === "failed" && (
          <FailureActions
            run={run}
            pending={actionPending}
            onResume={onResume}
            onRestart={() => {
              if (window.confirm("重新运行全部会创建新任务，可能再次产生费用。继续？")) onRestart();
            }}
          />
        )}
        {run.status === "succeeded" && (
          <PartialRerunActions
            run={run}
            selecting={selectingPartialRerun}
            preview={partialPreview}
            previewPendingNodeId={previewPendingNodeId}
            error={partialRerun.error}
            pending={actionPending}
            onBegin={partialRerun.onBegin}
            onChoose={partialRerun.onChoose}
            onCancel={partialRerun.onCancel}
            onConfirm={partialRerun.onConfirm}
          />
        )}
      </section>
    );

  return (
    <>
      {expanded ? (
        <section
          aria-label={t("workflow.progressTitle")}
          className="absolute top-20 right-3 z-20 hidden w-64 overflow-hidden rounded-xl border bg-background/95 shadow-lg backdrop-blur md:block"
        >
          <button
            type="button"
            aria-expanded="true"
            className="flex w-full items-center gap-2 border-b px-3 py-2 text-left hover:bg-muted/50"
            onClick={() => {
              if (active || run.status === "failed") setCollapsedRunId(run.id);
              else setOpenedRunId(null);
            }}
          >
            <Activity className="size-4 text-primary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold">{t("workflow.progressTitle")}</span>
              <span className="block truncate text-[0.625rem] text-muted-foreground">
                {summary}
              </span>
            </span>
            <span className="text-[0.625rem] tabular-nums text-muted-foreground">
              {positionLabel}
            </span>
            <ChevronUp className="size-3.5 text-muted-foreground" aria-hidden />
          </button>

          <OverallProgress value={progress} label={summary} />

          <ol className="max-h-[calc(100vh-12rem)] overflow-y-auto p-1.5">
            {run.nodes.map((node, index) => (
              <li key={node.nodeId}>
                <button
                  type="button"
                  aria-current={node.status === "running" ? "step" : undefined}
                  aria-label={
                    selectingPartialRerun
                      ? t("workflow.partialRerunFromNode", {
                          index: index + 1,
                          name: nodeLabel(t, node),
                        })
                      : undefined
                  }
                  aria-pressed={
                    selectingPartialRerun ? partialPreview?.fromNodeId === node.nodeId : undefined
                  }
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted",
                    node.status === "running" && "bg-primary/10 ring-1 ring-primary/25",
                    node.status === "failed" && "bg-destructive/10",
                    previewReusedIds.has(node.nodeId) && "bg-emerald-500/10",
                    previewRerunIds.has(node.nodeId) && "bg-amber-500/10 ring-1 ring-amber-500/30",
                  )}
                  disabled={selectingPartialRerun && actionPending !== null}
                  onClick={() => {
                    focusNode(node);
                    if (selectingPartialRerun) partialRerun.onChoose(node.nodeId);
                  }}
                >
                  {selectingPartialRerun && previewPendingNodeId === node.nodeId ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
                  ) : (
                    <StepStatusIcon status={node.status} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {index + 1}. {nodeLabel(t, node)}
                    </span>
                    <span
                      className={cn(
                        "block text-[0.625rem] text-muted-foreground",
                        node.status === "running" && "font-medium text-primary",
                        node.status === "failed" && "text-destructive",
                      )}
                    >
                      {nodeStatusLabel(t, node.status)}
                      {node.isReused ? ` · ${t("workflow.statusReused")}` : ""}
                      {previewReusedIds.has(node.nodeId)
                        ? ` · ${t("workflow.statusWillReuse")}`
                        : ""}
                      {previewRerunIds.has(node.nodeId)
                        ? ` · ${t("workflow.statusWillRerun")}`
                        : ""}
                      {node.status === "running" && node.progress !== null
                        ? ` · ${Math.round(clampProgress(node.progress) * 100)}%`
                        : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {run.status === "failed" && (
            <FailureActions
              run={run}
              pending={actionPending}
              onResume={onResume}
              onRestart={onRestart}
            />
          )}
          {run.status === "succeeded" && (
            <PartialRerunActions
              run={run}
              selecting={selectingPartialRerun}
              preview={partialPreview}
              previewPendingNodeId={previewPendingNodeId}
              error={partialRerun.error}
              pending={actionPending}
              onBegin={() => {
                setOpenedRunId(run.id);
                partialRerun.onBegin();
              }}
              onChoose={partialRerun.onChoose}
              onCancel={partialRerun.onCancel}
              onConfirm={partialRerun.onConfirm}
            />
          )}
        </section>
      ) : (
        <button
          type="button"
          aria-expanded="false"
          className="absolute top-20 right-3 z-20 hidden items-center gap-2 rounded-xl border bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur hover:bg-muted md:flex"
          onClick={() => {
            setCollapsedRunId(null);
            setOpenedRunId(run.id);
          }}
        >
          <RunStatusIcon status={run.status} />
          <span>{t("workflow.progressTitle")}</span>
          <span className="tabular-nums text-muted-foreground">{positionLabel}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        </button>
      )}

      <section
        aria-label={t("workflow.progressTitle")}
        aria-live="polite"
        className="absolute right-14 bottom-2 left-2 z-20 overflow-hidden rounded-xl border bg-background/95 px-3 py-2 shadow-lg backdrop-blur md:hidden"
      >
        <div className="flex items-center gap-2">
          <RunStatusIcon status={run.status} />
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{summary}</span>
          <span className="text-[0.625rem] tabular-nums text-muted-foreground">
            {positionLabel}
          </span>
        </div>
        <OverallProgress value={progress} label={summary} compact />
        {run.status === "failed" && (
          <FailureActions
            run={run}
            pending={actionPending}
            onResume={onResume}
            onRestart={onRestart}
            compact
          />
        )}
        {run.status === "succeeded" && (
          <PartialRerunActions
            run={run}
            selecting={selectingPartialRerun}
            preview={partialPreview}
            previewPendingNodeId={previewPendingNodeId}
            error={partialRerun.error}
            pending={actionPending}
            onBegin={partialRerun.onBegin}
            onChoose={partialRerun.onChoose}
            onCancel={partialRerun.onCancel}
            onConfirm={partialRerun.onConfirm}
            compact
          />
        )}
      </section>
    </>
  );
}

function PartialRerunActions({
  run,
  selecting,
  preview,
  previewPendingNodeId,
  error,
  pending,
  onBegin,
  onChoose,
  onCancel,
  onConfirm,
  compact = false,
}: {
  run: WorkflowRun;
  selecting: boolean;
  preview: WorkflowPartialRerunPreview | null;
  previewPendingNodeId: string | null;
  error: string | null;
  pending: RunAction | null;
  onBegin: () => void;
  onChoose: (nodeId: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  compact?: boolean;
}) {
  const t = useT();

  return (
    <div className={cn("border-t p-2", compact && "mt-2 -mx-1 -mb-1 px-1 pb-1")}>
      {!selecting ? (
        <Button
          size="xs"
          variant="outline"
          className="w-full text-[0.625rem]"
          isDisabled={pending !== null}
          onPress={onBegin}
        >
          <RotateCcw className="size-3" aria-hidden />
          {t("workflow.partialRerun")}
        </Button>
      ) : (
        <>
          <p className="mb-2 text-[0.625rem] leading-relaxed text-muted-foreground">
            {t("workflow.partialRerunHint")}
          </p>
          {compact && (
            <select
              aria-label={t("workflow.partialRerunChooseNode")}
              className="mb-2 h-8 w-full rounded-md border bg-background px-2 text-xs"
              value={preview?.fromNodeId ?? previewPendingNodeId ?? ""}
              disabled={pending !== null}
              onChange={(event) => {
                if (event.target.value) onChoose(event.target.value);
              }}
            >
              <option value="">{t("workflow.partialRerunChooseNode")}</option>
              {run.nodes.map((node, index) => (
                <option key={node.nodeId} value={node.nodeId}>
                  {index + 1}. {nodeLabel(t, node)}
                </option>
              ))}
            </select>
          )}
          {previewPendingNodeId && (
            <p className="mb-2 flex items-center gap-1 text-[0.625rem] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              {t("common.loading")}
            </p>
          )}
          {preview && (
            <>
              <p className="mb-1 text-[0.625rem] font-medium">
                {t("workflow.partialRerunPreview", {
                  reused: preview.reusedNodeIds.length,
                  rerun: preview.rerunNodeIds.length,
                })}
              </p>
              <p className="mb-2 text-[0.625rem] leading-relaxed text-muted-foreground">
                {t("workflow.partialRerunCostWarning")}
              </p>
            </>
          )}
          {error && <p className="mb-2 text-[0.625rem] text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              size="xs"
              className="min-w-0 px-2 text-[0.625rem]"
              isDisabled={!preview || previewPendingNodeId !== null || pending !== null}
              onPress={onConfirm}
            >
              {pending === "partial" ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <Play className="size-3" aria-hidden />
              )}
              <span className="truncate">{t("workflow.partialRerunConfirm")}</span>
            </Button>
            <Button
              size="xs"
              variant="outline"
              className="min-w-0 px-2 text-[0.625rem]"
              isDisabled={pending !== null}
              onPress={onCancel}
            >
              <span className="truncate">{t("workflow.partialRerunCancel")}</span>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function FailureActions({
  run,
  pending,
  onResume,
  onRestart,
  compact = false,
}: {
  run: WorkflowRun;
  pending: RunAction | null;
  onResume: () => void;
  onRestart: () => void;
  compact?: boolean;
}) {
  const t = useT();
  const reused = run.nodes.filter((node) => node.status === "succeeded").length;
  const remaining = run.nodes.length - reused;

  return (
    <div className={cn("border-t p-2", compact && "mt-2 -mx-1 -mb-1 px-1 pb-1")}>
      <p className="mb-2 text-[0.625rem] leading-relaxed text-muted-foreground">
        {t("workflow.resumeDescription", { reused, remaining })}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          size="xs"
          className="min-w-0 px-2 text-[0.625rem]"
          isDisabled={pending !== null}
          onPress={onResume}
        >
          {pending === "resume" ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <Play className="size-3" aria-hidden />
          )}
          <span className="truncate">{t("workflow.resumeRun")}</span>
        </Button>
        <Button
          size="xs"
          variant="outline"
          className="min-w-0 px-2 text-[0.625rem]"
          isDisabled={pending !== null}
          onPress={onRestart}
        >
          {pending === "restart" ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <RotateCcw className="size-3" aria-hidden />
          )}
          <span className="truncate">{t("workflow.restartRun")}</span>
        </Button>
      </div>
    </div>
  );
}

function OverallProgress({
  value,
  label,
  compact = false,
}: {
  value: number;
  label: string;
  compact?: boolean;
}) {
  const percent = Math.round(value * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn(
        "overflow-hidden bg-muted",
        compact ? "mt-2 h-1" : "mx-3 my-2 h-1.5 rounded-full",
      )}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function StepStatusIcon({ status }: { status: WorkflowNodeRunStatus }) {
  if (status === "running" || status === "retrying") {
    return <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />;
  }
  if (status === "succeeded") {
    return <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-hidden />;
  }
  if (status === "failed") {
    return <XCircle className="size-4 shrink-0 text-destructive" aria-hidden />;
  }
  if (status === "cancelled" || status === "skipped") {
    return <MinusCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
  }
  return <Circle className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />;
}

function RunStatusIcon({ status }: { status: WorkflowRunStatus }) {
  if (status === "queued" || status === "running") {
    return <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />;
  }
  if (status === "succeeded") {
    return <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-hidden />;
  }
  if (status === "failed") {
    return <XCircle className="size-4 shrink-0 text-destructive" aria-hidden />;
  }
  return <MinusCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
}

function overallProgress(run: WorkflowRun): number {
  if (run.nodes.length === 0) return 0;
  const value = run.nodes.reduce((total, node) => {
    if (isTerminalNode(node.status)) return total + 1;
    if (node.status === "running" && node.progress !== null) {
      return total + clampProgress(node.progress);
    }
    return total;
  }, 0);
  return value / run.nodes.length;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function isTerminalNode(status: WorkflowNodeRunStatus): boolean {
  return (
    status === "succeeded" || status === "failed" || status === "cancelled" || status === "skipped"
  );
}

function nodeLabel(t: Translate, node: WorkflowNodeRun): string {
  const labels = {
    text: "workflow.nodeText",
    image: "workflow.nodeImage",
    imageGenerate: "workflow.nodeImageGenerate",
    videoGenerate: "workflow.nodeVideoGenerate",
    videoExtend: "workflow.nodeVideoExtend",
    videoFrame: "workflow.nodeVideoFrame",
    imageOutput: "workflow.nodeImageOutput",
    videoOutput: "workflow.nodeVideoOutput",
    output: "workflow.nodeOutput",
    start: "workflow.nodeText",
    llm: "workflow.nodeText",
    knowledgeRetrieve: "workflow.nodeText",
    knowledgeAnswer: "workflow.nodeText",
    condition: "workflow.nodeText",
    merge: "workflow.nodeText",
    httpRequest: "workflow.nodeHttpRequest",
    end: "workflow.nodeOutput",
    parameterExtract: "workflow.nodeText",
    intentClassify: "workflow.nodeText",
    transform: "workflow.nodeText",
  } as const;
  return labels[node.nodeType] ? t(labels[node.nodeType]) : String(node.nodeType);
}

function nodeStatusLabel(t: Translate, status: WorkflowNodeRunStatus): string {
  const labels = {
    queued: "workflow.statusQueued",
    running: "workflow.statusRunning",
    retrying: "workflow.statusRetrying",
    succeeded: "workflow.statusSucceeded",
    failed: "workflow.statusFailed",
    cancelled: "workflow.statusCancelled",
    skipped: "workflow.statusSkipped",
  } as const;
  return t(labels[status]);
}

function runStatusLabel(t: Translate, status: WorkflowRunStatus): string {
  const labels = {
    queued: "workflow.runQueued",
    running: "workflow.running",
    succeeded: "workflow.runSucceeded",
    failed: "workflow.runFailed",
    cancelled: "workflow.runCancelled",
  } as const;
  return t(labels[status]);
}
