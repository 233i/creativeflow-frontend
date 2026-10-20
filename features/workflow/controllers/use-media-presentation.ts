"use client";
import { useCallback, useMemo } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";
import {
  getPartialRerunNodeVisualState,
  getPartialRerunEdgeVisualState,
} from "../partial-rerun-preview";
import { workflowNodeLabel } from "../presentation/media-labels";
import type { WorkflowGraph, WorkflowRun, WorkflowPartialRerunPreview } from "../types";
export function useMediaPresentation(
  graph: WorkflowGraph,
  run: WorkflowRun | null,
  partialRerunSourceNodeIds: ReadonlySet<string> | null,
  partialRerunPreview: WorkflowPartialRerunPreview | null,
) {
  const t = useT();
  const { nodes, edges } = graph;
  const active = run?.status === "queued" || run?.status === "running";
  const nodeColour = useCallback(
    (node: { id?: string; type?: string }) => {
      if (node.id) {
        const previewState = getPartialRerunNodeVisualState(
          node.id,
          partialRerunSourceNodeIds,
          partialRerunPreview,
        );
        if (previewState === "start" || previewState === "rerun") return "#f59e0b";
        if (previewState === "reuse") return "#10b981";
        if (previewState === "unavailable") return "#94a3b8";
      }
      if (node.type === "text") return "#8b5cf6";
      if (node.type === "videoGenerate") return "#f43f5e";
      if (node.type === "videoExtend") return "#e11d48";
      if (node.type === "videoFrame") return "#0ea5e9";
      if (node.type === "videoOutput") return "#f59e0b";
      if (node.type === "imageOutput" || node.type === "output") return "#22c55e";
      return "#06b6d4";
    },
    [partialRerunPreview, partialRerunSourceNodeIds],
  );

  const displayNodes = useMemo(
    () =>
      nodes.map((node) => {
        const previewState = getPartialRerunNodeVisualState(
          node.id,
          partialRerunSourceNodeIds,
          partialRerunPreview,
        );
        const previewClass =
          previewState === "start"
            ? "workflow-node-rerun-candidate workflow-node-rerun-start"
            : previewState === "rerun"
              ? "workflow-node-rerun-candidate workflow-node-will-rerun"
              : previewState === "reuse"
                ? "workflow-node-rerun-candidate workflow-node-will-reuse"
                : previewState === "candidate"
                  ? "workflow-node-rerun-candidate"
                  : previewState === "unavailable"
                    ? "workflow-node-preview-unavailable"
                    : undefined;
        return {
          ...node,
          className: cn(node.className, previewClass),
          ariaLabel:
            previewState && previewState !== "unavailable"
              ? t("workflow.partialRerunFromNode", {
                  index: (run?.nodes.findIndex((item) => item.nodeId === node.id) ?? -1) + 1,
                  name: workflowNodeLabel(t, node),
                })
              : node.ariaLabel,
        };
      }),
    [nodes, partialRerunPreview, partialRerunSourceNodeIds, run?.nodes, t],
  );

  const displayEdges = useMemo(() => {
    if (!run) return edges;
    const statuses = new Map(run.nodes.map((node) => [node.nodeId, node.status]));
    return edges.map((edge) => {
      const sourceStatus = statuses.get(edge.source);
      const targetStatus = statuses.get(edge.target);
      const previewState = getPartialRerunEdgeVisualState(
        edge,
        partialRerunSourceNodeIds,
        partialRerunPreview,
      );
      const executionClass = partialRerunSourceNodeIds
        ? previewState === "rerun"
          ? "workflow-edge-will-rerun"
          : previewState === "reuse"
            ? "workflow-edge-will-reuse"
            : previewState === "unavailable"
              ? "workflow-edge-preview-unavailable"
              : undefined
        : targetStatus === "running"
          ? "workflow-edge-active"
          : sourceStatus === "succeeded" && targetStatus === "succeeded"
            ? "workflow-edge-complete"
            : active
              ? "workflow-edge-pending"
              : undefined;
      return {
        ...edge,
        animated: previewState === "rerun" || targetStatus === "running",
        className: [edge.className, executionClass].filter(Boolean).join(" "),
      };
    });
  }, [active, edges, partialRerunPreview, partialRerunSourceNodeIds, run]);

  return { nodeColour, displayNodes, displayEdges };
}
