"use client";
import type { WorkflowDraft } from "../controllers/use-workflow-draft";
import type { WorkflowRuns } from "../controllers/use-workflow-runs";
import type { WorkflowActions } from "../controllers/use-workflow-actions";
import type { V2InspectorMode } from "../inspector";
import type { WorkflowClient } from "../../api";
import { V2Inspector } from "../inspector";
import { V2RunInputs } from "../run-inputs";
import { NodeDebugPanel } from "../node-debug-panel";
import { V2RunPanel } from "../run-panel";
import { V2NodeConfig } from "../node-config";
export function V2EditorInspector({
  draft,
  runs,
  actions,
  client,
  admin,
  selectedId,
  inspector,
  error,
  onMode,
  onClose,
  onLocate,
  onSelect,
}: {
  draft: WorkflowDraft;
  runs: WorkflowRuns;
  actions: WorkflowActions;
  client: WorkflowClient;
  admin: boolean;
  selectedId: string;
  inspector: V2InspectorMode;
  error: string | null;
  onMode: (mode: V2InspectorMode) => void;
  onClose: () => void;
  onLocate: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const { document, graph } = draft;
  const { run, debugRun, active, debugActive, clock } = runs;
  const { fields, busy, debugPending } = actions;
  const selected = graph.nodes.find((node) => node.id === selectedId);
  return (
    <V2Inspector
      mode={inspector}
      hasRun={!!run}
      hasNode={!!selected}
      onMode={onMode}
      onClose={onClose}
    >
      {inspector === "input" ? (
        <V2RunInputs
          fields={fields}
          draft={actions.inputs}
          onChange={actions.setInputs}
          busy={busy || active || debugActive}
          error={error}
          onSubmit={() => void actions.execute()}
        />
      ) : inspector === "debug" ? (
        selected ? (
          <NodeDebugPanel
            key={`${selected.id}:${actions.resultsVersion}`}
            workflowId={document.id}
            node={selected}
            graph={graph}
            client={client}
            blocked={debugBlocked(runs, busy, selected.id) || actions.state.status === "uncertain"}
            pendingRequest={debugPending[selected.id] ?? null}
            onPending={(request) => actions.rememberDebugRequest(selected.id, request)}
            run={debugRun?.debugNodeId === selected.id ? debugRun : null}
            onRun={runs.setDebugRun}
            onLocate={onLocate}
            onSubmit={(request) => actions.submitDebug(selected.id, request)}
          />
        ) : (
          <p className="p-4 text-xs">目标节点已不在草稿中。请从运行历史查看原快照。</p>
        )
      ) : inspector === "run" ? (
        run ? (
          <V2RunPanel
            key={run.id}
            run={run}
            graph={graph}
            now={clock}
            busy={busy}
            onLocate={onLocate}
            onRefresh={() => void runs.refresh()}
            onResume={() => void actions.resume()}
            onRetryNode={(nodeId) => void actions.retryNode(nodeId)}
            onSkipNode={(nodeId) => void actions.skipNode(nodeId)}
            onRollback={(nodeId) => void actions.rollback(nodeId)}
          />
        ) : (
          <p className="p-4 text-xs text-muted-foreground">运行不可用，已清除本页结果。</p>
        )
      ) : (
        <fieldset disabled={busy}>
          {selected ? (
            <V2NodeConfig
              key={selected.id}
              node={selected}
              graph={graph}
              onChange={(data) => draft.updateData(selected.id, data)}
              admin={admin}
              onBind={(key, source, handle, additional) =>
                draft.bind(selected.id, key, source, handle, additional)
              }
              onRemove={() => {
                draft.remove(selected.id);
                onSelect(graph.nodes.find((node) => node.type === "start")?.id ?? "");
              }}
            />
          ) : (
            <p className="p-4 text-xs text-muted-foreground">选择节点查看配置</p>
          )}
        </fieldset>
      )}
    </V2Inspector>
  );
}

function debugBlocked(runs: WorkflowRuns, busy: boolean, nodeId: string) {
  return runs.active || busy || (runs.debugActive && runs.debugRun?.debugNodeId !== nodeId);
}
