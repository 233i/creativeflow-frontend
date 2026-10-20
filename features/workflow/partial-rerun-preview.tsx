"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WorkflowEdge, WorkflowPartialRerunPreview } from "@/features/workflow/types";

export type PartialRerunNodeVisualState =
  "candidate" | "unavailable" | "reuse" | "rerun" | "start" | null;

export type PartialRerunEdgeVisualState = "reuse" | "rerun" | "unavailable" | null;

interface PartialRerunPreviewContextValue {
  sourceNodeIds: ReadonlySet<string> | null;
  preview: WorkflowPartialRerunPreview | null;
}

const PartialRerunPreviewContext = createContext<PartialRerunPreviewContextValue>({
  sourceNodeIds: null,
  preview: null,
});

export function WorkflowPartialRerunPreviewProvider({
  sourceNodeIds,
  preview,
  children,
}: PartialRerunPreviewContextValue & { children: ReactNode }) {
  return (
    <PartialRerunPreviewContext value={{ sourceNodeIds, preview }}>
      {children}
    </PartialRerunPreviewContext>
  );
}

export function usePartialRerunNodeVisualState(nodeId: string): PartialRerunNodeVisualState {
  const { sourceNodeIds, preview } = useContext(PartialRerunPreviewContext);
  return getPartialRerunNodeVisualState(nodeId, sourceNodeIds, preview);
}

export function getPartialRerunNodeVisualState(
  nodeId: string,
  sourceNodeIds: ReadonlySet<string> | null,
  preview: WorkflowPartialRerunPreview | null,
): PartialRerunNodeVisualState {
  if (!sourceNodeIds) return null;
  if (!sourceNodeIds.has(nodeId)) return "unavailable";
  if (!preview) return "candidate";
  if (preview.fromNodeId === nodeId) return "start";
  if (preview.rerunNodeIds.includes(nodeId)) return "rerun";
  if (preview.reusedNodeIds.includes(nodeId)) return "reuse";
  return "unavailable";
}

export function getPartialRerunEdgeVisualState(
  edge: WorkflowEdge,
  sourceNodeIds: ReadonlySet<string> | null,
  preview: WorkflowPartialRerunPreview | null,
): PartialRerunEdgeVisualState {
  if (!sourceNodeIds) return null;
  if (!sourceNodeIds.has(edge.source) || !sourceNodeIds.has(edge.target)) {
    return "unavailable";
  }
  if (!preview) return null;
  if (preview.rerunNodeIds.includes(edge.target)) return "rerun";
  if (preview.reusedNodeIds.includes(edge.source) && preview.reusedNodeIds.includes(edge.target)) {
    return "reuse";
  }
  return "unavailable";
}
