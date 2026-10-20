"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactFlowInstance } from "@xyflow/react";
import type { WorkflowClient, WorkflowDocument } from "../api";
import type { WorkflowRun } from "../types";
import { useEditorSession, useWorkflowDetail, WorkflowDetailHeader } from "../editor-session";
import { WorkflowPublishPanel } from "../external-api/publish-panel";
import { v2PublicationManifest } from "../external-api/contracts";
import { V2RunHistory } from "./run-history";
import type { V2InspectorMode } from "./inspector";
import type { WorkflowV2Kind, WorkflowV2Node } from "./types";
import { placeNode } from "./placement";
import { useWorkflowDraft } from "./controllers/use-workflow-draft";
import { useWorkflowRuns } from "./controllers/use-workflow-runs";
import { useWorkflowActions } from "./controllers/use-workflow-actions";
import { useNodeCapabilities } from "./controllers/use-node-capabilities";
import { V2EditorToolbar } from "./components/editor-toolbar";
import { V2EditorCanvas } from "./components/editor-canvas";
import { V2EditorInspector } from "./components/editor-inspector";
import { V2PartialRerunDialog } from "./components/partial-rerun-dialog";

interface Props {
  initialDocument: WorkflowDocument;
  initialRun: WorkflowRun | null;
  client: WorkflowClient;
  admin: boolean;
  initialError?: string;
}

/** Each document owns one draft, request scope and debug idempotency session. */
export function WorkflowV2Editor(props: Props) {
  return <WorkflowV2Session key={props.initialDocument.id} {...props} />;
}

function WorkflowV2Session({ initialDocument, initialRun, client, admin, initialError }: Props) {
  const router = useRouter();
  const detail = useWorkflowDetail();
  const draft = useWorkflowDraft(initialDocument, client);
  const { document, graph, dirty } = draft;
  const [selectedId, setSelectedId] = useState(
    () => initialRun?.debugNodeId ?? graph.nodes.find((node) => node.type === "llm")?.id ?? "",
  );
  const [inspector, setInspector] = useState<V2InspectorMode | null>(() =>
    initialRun?.debugNodeId ? "debug" : initialRun ? "run" : selectedId ? "node" : null,
  );
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const runs = useWorkflowRuns(document.id, initialRun, client, admin, handleDenied);
  const actions = useWorkflowActions({ draft, runs, client, showRun, setError });
  const availableKinds = useNodeCapabilities(client);
  const flow = useRef<ReactFlowInstance<WorkflowV2Node> | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const { busy } = actions;
  useEditorSession(document, graph, dirty, busy, actions.save);

  function handleDenied(_kind: "run" | "debug", message: string) {
    runs.clear();
    actions.clearResults();
    setError(message);
  }
  function showRun(value: WorkflowRun) {
    if (value.debugNodeId) {
      runs.setDebugRun(value);
      setSelectedId(value.debugNodeId);
      setInspector("debug");
    } else {
      runs.setRun(value);
      runs.setClock(Date.parse(value.updatedAt));
      setInspector("run");
    }
  }
  function selectNode(id: string) {
    setSelectedId(id);
    setInspector("node");
  }
  function openDebug() {
    if (runs.debugRun?.debugNodeId) setSelectedId(runs.debugRun.debugNodeId);
    setInspector("debug");
  }
  function leave() {
    if (detail) detail.leave(detail.returnHref);
    else if (!dirty || window.confirm("有未保存修改，确定离开？"))
      router.push(admin ? "/admin?tab=workflowApis" : "/");
  }
  function beginRun() {
    setError(null);
    if (actions.fields.length) setInspector("input");
    else if (!runs.run || window.confirm("重新运行全部会创建新任务，可能再次产生费用。继续？"))
      void actions.execute();
  }
  function locateNode(id: string) {
    if (detail && runs.run && inspector !== "debug") {
      detail.inspectRun(runs.run.id, id);
      return;
    }
    const node = graph.nodes.find((item) => item.id === id);
    if (!node) {
      setError("此节点不在当前草稿中，结果来自原运行快照。");
      return;
    }
    setSelectedId(id);
    draft.setGraph((value) => ({
      ...value,
      nodes: value.nodes.map((item) => ({ ...item, selected: item.id === id })),
    }));
    if (window.matchMedia("(max-width: 639px)").matches) setInspector(null);
    void flow.current?.fitView({ nodes: [node], maxZoom: 1, duration: 300 });
  }
  function addNode(kind: WorkflowV2Kind, at?: { x: number; y: number }) {
    if (busy || !availableKinds.includes(kind)) return;
    const existing = graph.nodes.find((node) => node.type === kind);
    if (!at && (kind === "start" || kind === "end") && existing) {
      selectNode(existing.id);
      return;
    }
    const rect = stage.current?.getBoundingClientRect();
    const position =
      at ??
      (rect && flow.current
        ? flow.current.screenToFlowPosition({
            x: rect.left + rect.width / 2 - 100,
            y: rect.top + rect.height / 2 - 70,
          })
        : { x: 360, y: 150 + graph.nodes.length * 80 });
    try {
      const placed = placeNode(graph, kind, position, crypto.randomUUID());
      draft.change(placed.graph);
      selectNode(placed.nodeId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法创建节点。");
    }
  }
  return (
    <div
      className={`flex ${detail ? "h-full" : "h-dvh"} min-h-0 flex-col overflow-hidden bg-background`}
    >
      <WorkflowDetailHeader>
        <V2EditorToolbar
          draft={draft}
          runs={runs}
          actions={actions}
          admin={admin}
          selectedId={selectedId}
          inspector={inspector}
          onBack={leave}
          onHistory={() => (detail ? detail.select("runs") : setHistoryOpen(true))}
          onPublish={() => (detail ? detail.select("publications") : setPublishOpen(true))}
          onInspector={setInspector}
          onActiveDebug={openDebug}
          onExecute={beginRun}
        />
      </WorkflowDetailHeader>
      {(error || runs.connectionError) && inspector !== "input" && (
        <p role="alert" className="border-b bg-destructive/5 px-4 py-2 text-xs text-destructive">
          {error ?? runs.connectionError}
        </p>
      )}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <V2EditorCanvas
          draft={draft}
          runs={runs}
          busy={busy}
          inspector={inspector}
          availableKinds={availableKinds}
          flowRef={flow}
          stage={stage}
          addNode={addNode}
          onSelect={selectNode}
          onActiveDebug={openDebug}
          onOpenRun={() => setInspector("run")}
        />
        {inspector && (!detail || detail.section === "edit") && (
          <V2EditorInspector
            draft={draft}
            runs={runs}
            actions={actions}
            client={client}
            admin={admin}
            selectedId={selectedId}
            inspector={inspector}
            error={error}
            onMode={setInspector}
            onClose={() => setInspector(null)}
            onLocate={locateNode}
            onSelect={setSelectedId}
          />
        )}
      </div>
      <V2PartialRerunDialog
        value={actions.partial}
        busy={busy}
        error={error}
        onClose={actions.clearPartial}
        onConfirm={() => void actions.confirmPartial()}
      />
      {admin && publishOpen && (
        <WorkflowPublishPanel
          workflowId={document.id}
          workflowName={document.name}
          updatedAt={document.updatedAt}
          manifest={v2PublicationManifest(graph)}
          isOpen
          onOpenChange={setPublishOpen}
          onBeforePublish={actions.save}
        />
      )}
      {historyOpen && (
        <V2RunHistory
          workflowId={document.id}
          client={client}
          onClose={() => setHistoryOpen(false)}
          onSelect={showRun}
          onDenied={() => {
            runs.clear();
            actions.clearResults();
          }}
        />
      )}
    </div>
  );
}
