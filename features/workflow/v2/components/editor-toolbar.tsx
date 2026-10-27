"use client";
import type { WorkflowDraft } from "../controllers/use-workflow-draft";
import type { WorkflowRuns } from "../controllers/use-workflow-runs";
import type { WorkflowActions } from "../controllers/use-workflow-actions";
import type { V2InspectorMode } from "../inspector";
import { Activity, ArrowLeft, Code2, Play, Save, Square } from "lucide-react";
import { actionClass } from "../config-styles";
import { useWorkspaceElementId } from "@/components/providers/workspace-context";
export function V2EditorToolbar({
  draft,
  runs,
  actions,
  admin,
  selectedId,
  inspector,
  onBack,
  onHistory,
  onPublish,
  onInspector,
  onActiveDebug,
  onExecute,
}: {
  draft: WorkflowDraft;
  runs: WorkflowRuns;
  actions: WorkflowActions;
  admin: boolean;
  selectedId: string;
  inspector: V2InspectorMode | null;
  onBack: () => void;
  onHistory: () => void;
  onPublish: () => void;
  onInspector: (mode: V2InspectorMode | null) => void;
  onActiveDebug: () => void;
  onExecute: () => void;
}) {
  const { document, graph, dirty } = draft;
  const { run, active, debugActive } = runs;
  const { busy } = actions;
  const detailsId = useWorkspaceElementId("v2-run-details-trigger");
  const triggerId = useWorkspaceElementId("v2-run-trigger");
  const inspectorId = useWorkspaceElementId("v2-inspector");
  const selected = graph.nodes.find((node) => node.id === selectedId);
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-3">
      <button aria-label="返回" className={actionClass} onClick={onBack}>
        <ArrowLeft className="size-4" />
      </button>
      <div className="min-w-0 flex-1 basis-[calc(100%-4rem)] sm:basis-0">
        <input
          aria-label="AI 工作流名称"
          disabled={busy}
          className="w-full max-w-full bg-transparent text-sm font-semibold outline-none"
          value={document.name}
          maxLength={200}
          onChange={(event) => draft.rename(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          通用编排 · schema 1 · {dirty ? "未保存" : "已保存"}
        </p>
      </div>
      <button className={actionClass} disabled={busy} onClick={() => void actions.save()}>
        <Save className="mr-1 inline size-3.5" />
        保存
      </button>
      <button className={actionClass} disabled={busy} onClick={onHistory}>
        运行历史
      </button>
      <button
        id={detailsId}
        className={`${actionClass} ${inspector === "run" ? "border-primary/30 bg-primary/5 text-primary" : ""}`}
        disabled={!run}
        aria-expanded={inspector === "run"}
        aria-controls={inspectorId}
        onClick={() => onInspector(inspector === "run" ? null : "run")}
      >
        <Activity className="mr-1 inline size-3.5" />
        执行详情
      </button>
      {admin && (
        <button className={actionClass} disabled={busy} onClick={onPublish}>
          <Code2 className="mr-1 inline size-3.5" />
          发布
        </button>
      )}
      <button
        className={actionClass}
        disabled={busy || !selected}
        onClick={() => onInspector("debug")}
      >
        单节点调试
      </button>
      {debugActive && (
        <button className={`${actionClass} text-primary`} onClick={onActiveDebug}>
          查看进行中调试
        </button>
      )}
      {run?.status === "succeeded" && !run.debugNodeId && (
        <button
          className={actionClass}
          disabled={busy || debugActive || !run.nodes.some((node) => node.nodeId === selectedId)}
          onClick={() => void actions.preview(selectedId)}
        >
          从选中节点重跑
        </button>
      )}
      <button
        id={triggerId}
        className={`${actionClass} bg-primary text-primary-foreground hover:bg-primary/90`}
        disabled={busy || active || debugActive}
        onClick={onExecute}
      >
        <Play className="mr-1 inline size-3.5" />
        运行
      </button>
      {active && (
        <button className={actionClass} disabled={busy} onClick={() => void actions.cancel()}>
          <Square className="mr-1 inline size-3" />
          停止
        </button>
      )}
    </header>
  );
}
