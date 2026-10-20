"use client";

import { useRef, useState } from "react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import type { WorkflowClient, WorkflowDocument } from "../../api";
import { useRequestScope } from "../../controllers/use-request-scope";
import {
  canConnect,
  pruneInvalidEdges,
  snapshotGraph,
  type WorkflowV2Graph,
  type WorkflowV2Node,
  type WorkflowV2NodeData,
} from "../types";

function replaceNodeData<N extends WorkflowV2Node>(node: N, data: N["data"]): N {
  return { ...node, data };
}

/** Manual save only. Selection and measurement remain renderer state, never draft revisions. */
export function useWorkflowDraft(initial: WorkflowDocument, client: WorkflowClient) {
  const [document, setDocument] = useState(initial);
  const [graph, setGraph] = useState(() => initial.graph as WorkflowV2Graph);
  const [dirty, setDirty] = useState(false);
  const revision = useRef(0);
  const capture = useRequestScope(initial.id);
  function markDirty() {
    revision.current += 1;
    setDirty(true);
  }
  function change(next: WorkflowV2Graph) {
    setGraph(next);
    markDirty();
  }
  function rename(name: string) {
    setDocument((value) => ({ ...value, name }));
    markDirty();
  }
  async function save(name = document.name) {
    const current = capture();
    const savedRevision = revision.current;
    const sanitized = pruneInvalidEdges(graph);
    const saved = await client.saveWorkflow(document.id, snapshotGraph(sanitized), name);
    if (!current()) return false;
    const unchanged = revision.current === savedRevision;
    setDocument((value) => (unchanged ? saved : { ...saved, name: value.name }));
    if (unchanged) {
      if (sanitized !== graph) setGraph(sanitized);
      setDirty(false);
    }
    return unchanged;
  }
  function onNodesChange(changes: NodeChange<WorkflowV2Node>[]) {
    setGraph((value) => {
      const nodes = applyNodeChanges(
        changes.filter(
          (item) =>
            item.type !== "remove" ||
            !["start", "end"].includes(
              value.nodes.find((node) => node.id === item.id)?.type ?? "start",
            ),
        ),
        value.nodes,
      );
      const ids = new Set(nodes.map((node) => node.id));
      return {
        ...value,
        nodes,
        edges: value.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
      };
    });
    if (changes.some((item) => item.type === "position" || item.type === "remove")) markDirty();
  }
  function onEdgesChange(changes: EdgeChange[]) {
    setGraph((value) => ({ ...value, edges: applyEdgeChanges(changes, value.edges) }));
    if (changes.some((item) => item.type !== "select")) markDirty();
  }
  function connect(connection: Connection) {
    if (connection.source && connection.target && canConnect(graph, connection))
      change({ ...graph, edges: addEdge({ ...connection, id: crypto.randomUUID() }, graph.edges) });
  }
  function updateData(id: string, data: WorkflowV2NodeData) {
    change(
      pruneInvalidEdges({
        ...graph,
        nodes: graph.nodes.map((node) => (node.id === id ? replaceNodeData(node, data) : node)),
      }),
    );
  }
  function bind(
    id: string,
    key: string,
    source: string,
    sourceHandle: string,
    additional: [string, string][] = [],
  ) {
    const edges = graph.edges.filter((edge) => edge.target !== id || edge.targetHandle !== key);
    const sources = source ? [[source, sourceHandle], ...additional] : additional;
    for (const [sourceId, handle] of sources)
      edges.push({
        id: crypto.randomUUID(),
        source: sourceId,
        sourceHandle: handle,
        target: id,
        targetHandle: key,
      });
    change({ ...graph, edges });
  }
  function remove(id: string) {
    change({
      ...graph,
      nodes: graph.nodes.filter((node) => node.id !== id),
      edges: graph.edges.filter((edge) => edge.source !== id && edge.target !== id),
    });
  }
  return {
    document,
    graph,
    dirty,
    save,
    rename,
    change,
    setGraph,
    onNodesChange,
    onEdgesChange,
    connect,
    updateData,
    bind,
    remove,
  };
}
export type WorkflowDraft = ReturnType<typeof useWorkflowDraft>;
