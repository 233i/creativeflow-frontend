"use client";
import { useCallback, useRef } from "react";
import { useReactFlow, type Connection } from "@xyflow/react";
import { useWorkflowStore } from "../store";
import type { WorkflowEdge, WorkflowNodeKind } from "../types";
import { WORKFLOW_NODE_SIZE } from "../types";
import { isValidWorkflowConnection } from "../validation";
export function useMediaCanvas() {
  const { screenToFlowPosition, fitView, getNodes } = useReactFlow();
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const externalApi = useWorkflowStore((state) => state.externalApi);
  const connect = useWorkflowStore((state) => state.connect);
  const addNode = useWorkflowStore((state) => state.addNode);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isValidConnection = useCallback(
    (connection: Connection | WorkflowEdge) => isValidWorkflowConnection(connection, nodes, edges),
    [edges, nodes],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (isValidConnection(connection)) connect(connection);
    },
    [connect, isValidConnection],
  );

  const addAt = useCallback(
    (kind: WorkflowNodeKind) => {
      const existing = getNodes();
      if (existing.length > 0) {
        const rightmost = existing.reduce((best, node) =>
          node.position.x > best.position.x ? node : best,
        );
        addNode(kind, {
          x: rightmost.position.x + (rightmost.width ?? 280) + 70,
          y: rightmost.position.y,
        });
        return;
      }
      const bounds = wrapperRef.current?.getBoundingClientRect();
      const center = screenToFlowPosition({
        x: (bounds?.left ?? 0) + (bounds?.width ?? 900) / 2,
        y: (bounds?.top ?? 0) + (bounds?.height ?? 600) / 2,
      });
      const size = WORKFLOW_NODE_SIZE[kind];
      addNode(kind, { x: center.x - size.width / 2, y: center.y - size.height / 2 });
    },
    [addNode, getNodes, screenToFlowPosition],
  );

  return {
    nodes,
    edges,
    externalApi,
    addNode,
    onNodesChange,
    onEdgesChange,
    wrapperRef,
    isValidConnection,
    onConnect,
    addAt,
    screenToFlowPosition,
    fitView,
  };
}
