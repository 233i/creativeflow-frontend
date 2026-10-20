"use client";
import { useT } from "@/components/providers/i18n-provider";
import { type CanvasNode } from "@/features/canvas/store";
import type { AgentRunStatus } from "./types";
interface SelectedNodeSummary {
  id: string;
  typeLabel: string;
  detail?: string;
}

export function summarizeSelectedNode(
  node: CanvasNode,
  t: ReturnType<typeof useT>,
): SelectedNodeSummary {
  const data = node.data as Record<string, unknown>;
  const typeLabel = (() => {
    switch (node.type) {
      case "image":
        return t("canvas.nodeImage");
      case "video":
        return t("canvas.nodeVideo");
      case "imageGen":
        return t("canvas.nodeImageGen");
      case "videoGen":
        return t("canvas.nodeVideoGen");
      default:
        return t("canvas.nodeText");
    }
  })();

  const detail =
    node.type === "text" || node.type === "image" || node.type === "video"
      ? compactNodeText(data.text ?? data.prompt)
      : compactNodeText(data.modelId);

  return { id: node.id, typeLabel, detail };
}

function compactNodeText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const compact = value.trim().replace(/\s+/g, " ");
  if (!compact) return undefined;
  return compact.length > 72 ? `${compact.slice(0, 72)}…` : compact;
}

export function statusLabel(status: AgentRunStatus, t: ReturnType<typeof useT>): string {
  switch (status) {
    case "queued":
      return t("agent.statusQueued");
    case "running":
      return t("agent.statusRunning");
    case "awaiting_canvas":
      return t("agent.statusAwaitingCanvas");
    case "awaiting_approval":
      return t("agent.statusAwaitingApproval");
    case "succeeded":
      return t("agent.statusSucceeded");
    case "failed":
      return t("agent.statusFailed");
    case "cancelled":
      return t("agent.statusCancelled");
    case "interrupted":
      return t("agent.statusInterrupted");
  }
}
