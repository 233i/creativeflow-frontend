"use client";
import type { WorkflowDraft } from "../controllers/use-workflow-draft";
import type { WorkflowRuns } from "../controllers/use-workflow-runs";
import type { V2InspectorMode } from "../inspector";
import { Background, Controls, ReactFlow, type ReactFlowInstance } from "@xyflow/react";
import type { RefObject } from "react";
import { V2DebugContext, V2NodeCard, V2RunContext } from "../node-card";
import { canConnect, type WorkflowV2Kind, type WorkflowV2Node } from "../types";
import { droppedKind, NODE_DRAG_MIME } from "../placement";
import { executionEdges } from "../run-presentation";
import { InitialGraphFit } from "../../initial-graph-fit";
import { V2NodeLibrary } from "../node-library";
import { V2RunProgress } from "../run-progress";
import { useWorkflowCanvasActive } from "../../editor-session";
const nodeTypes = {
  start: V2NodeCard,
  llm: V2NodeCard,
  end: V2NodeCard,
  knowledgeRetrieve: V2NodeCard,
  knowledgeAnswer: V2NodeCard,
  condition: V2NodeCard,
  merge: V2NodeCard,
  httpRequest: V2NodeCard,
  parameterExtract: V2NodeCard,
  intentClassify: V2NodeCard,
  transform: V2NodeCard,
  script: V2NodeCard,
  loop: V2NodeCard,
  batch: V2NodeCard,
} satisfies Record<WorkflowV2Kind, typeof V2NodeCard>;

export function V2EditorCanvas({
  draft,
  runs,
  busy,
  inspector,
  availableKinds,
  flowRef,
  stage,
  addNode,
  onSelect,
  onActiveDebug,
  onOpenRun,
}: {
  draft: WorkflowDraft;
  runs: WorkflowRuns;
  busy: boolean;
  inspector: V2InspectorMode | null;
  availableKinds: WorkflowV2Kind[];
  flowRef: RefObject<ReactFlowInstance<WorkflowV2Node> | null>;
  stage: RefObject<HTMLDivElement | null>;
  addNode: (kind: WorkflowV2Kind, at?: { x: number; y: number }) => void;
  onSelect: (id: string) => void;
  onActiveDebug: () => void;
  onOpenRun: () => void;
}) {
  const { graph } = draft;
  const pageActive = useWorkflowCanvasActive();
  const { run, debugRun, debugActive, clock } = runs;
  return (
    <div
      ref={stage}
      aria-label="工作流画布"
      className="relative min-h-0 min-w-0 flex-1 bg-canvas"
      onDragOver={(event) => {
        if (!busy && event.dataTransfer.types.includes(NODE_DRAG_MIME)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(event) => {
        const kind = droppedKind(event.dataTransfer.getData(NODE_DRAG_MIME), availableKinds);
        if (!kind || busy || !flowRef.current) return;
        event.preventDefault();
        addNode(kind, flowRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
      }}
    >
      <V2RunContext.Provider value={inspector === "debug" ? null : run}>
        <V2DebugContext.Provider value={inspector === "debug" ? debugRun : null}>
          <ReactFlow<WorkflowV2Node>
            id={`orchestration-${draft.document.id}`}
            nodes={graph.nodes}
            edges={executionEdges(graph, inspector === "debug" ? null : run)}
            nodeTypes={nodeTypes}
            onInit={(instance) => {
              flowRef.current = instance;
            }}
            onNodesChange={draft.onNodesChange}
            onEdgesChange={draft.onEdgesChange}
            onConnect={draft.connect}
            isValidConnection={(connection) => canConnect(graph, connection)}
            onNodeClick={(_, node) => onSelect(node.id)}
            nodesDraggable={!busy}
            nodesConnectable={!busy}
            deleteKeyCode={!pageActive || busy ? null : ["Backspace", "Delete"]}
            selectionKeyCode={pageActive ? undefined : null}
            multiSelectionKeyCode={pageActive ? undefined : null}
            panActivationKeyCode={pageActive ? undefined : null}
            zoomActivationKeyCode={pageActive ? undefined : null}
            minZoom={0.2}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={24} />
            <Controls position="bottom-left" />
            <InitialGraphFit />
          </ReactFlow>
        </V2DebugContext.Provider>
      </V2RunContext.Provider>
      <V2NodeLibrary
        kinds={availableKinds}
        busy={busy}
        nodeCount={graph.nodes.length}
        onAdd={addNode}
      />
      {debugActive || (inspector === "debug" && debugRun) ? (
        <V2RunProgress run={debugRun!} graph={graph} now={clock} onOpen={onActiveDebug} />
      ) : (
        run && <V2RunProgress run={run} graph={graph} now={clock} onOpen={onOpenRun} />
      )}
    </div>
  );
}
