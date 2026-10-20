"use client";

import { WorkflowRunProgressPanel } from "../run-progress-panel";
import { MediaNodeInspector } from "../media-node-inspector";
import { V2Inspector } from "../v2/inspector";
import { useWorkflowDetail } from "../editor-session";
import { nodeKind } from "../types";
import { NODE_TYPES } from "./media-node-types";
import type { MediaEditorModel } from "../controllers/use-media-editor";

export function MediaRunProgress({ editor }: { editor: MediaEditorModel }) {
  const detail = useWorkflowDetail();
  const { runs, actions, partial } = editor;
  const { run } = runs;
  if (!run) return null;
  return (
    <WorkflowRunProgressPanel
      run={run}
      actionPending={actions.runAction}
      embedded={!!detail}
      onRefresh={() => void runs.refresh()}
      onInspect={detail ? (id) => detail.inspectRun(run.id, id) : undefined}
      onResume={() => void actions.resume()}
      onRestart={() => void actions.execute()}
      partialRerun={{
        selecting: !!partial.selection,
        preview: partial.selection?.preview ?? null,
        previewPendingNodeId: partial.selection?.pendingNodeId ?? null,
        error: partial.selection?.error ?? null,
        onBegin: () => {
          if (!actions.busy) void partial.begin();
        },
        onChoose: (nodeId) => {
          if (!actions.busy) void partial.choose(nodeId);
        },
        onCancel: partial.clear,
        onConfirm: () => void actions.confirmPartial(),
      }}
    />
  );
}

export function MediaRunInspector({ editor }: { editor: MediaEditorModel }) {
  const detail = useWorkflowDetail();
  const { panels, runs, canvas, partial } = editor;
  const inspectedNode = canvas.nodes.find((node) => node.id === panels.inspectedNodeId);
  if (
    detail?.section !== "edit" ||
    (!(panels.nodeInspectorOpen && inspectedNode) && !(runs.run && panels.inspectorOpen))
  )
    return null;
  return (
    <V2Inspector
      mode={panels.nodeInspectorOpen && inspectedNode ? "node" : "run"}
      hasRun={!!runs.run}
      hasNode={!!inspectedNode}
      onMode={panels.switchInspector}
      onClose={() => {
        panels.setInspectorOpen(false);
        panels.runButton.current?.focus();
      }}
    >
      {panels.nodeInspectorOpen && inspectedNode ? (
        <fieldset disabled={!!partial.selection}>
          <MediaNodeInspector
            key={inspectedNode.id}
            node={inspectedNode}
            component={NODE_TYPES[nodeKind(inspectedNode)]}
          />
        </fieldset>
      ) : (
        <MediaRunProgress editor={editor} />
      )}
    </V2Inspector>
  );
}
