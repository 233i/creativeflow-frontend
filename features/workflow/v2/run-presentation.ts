import { MarkerType, type Edge } from "@xyflow/react";
import type { WorkflowNodeRun, WorkflowRun } from "../types";
import {
  branchPorts,
  CONTROL_PORT,
  NODE_LABELS,
  type WorkflowV2Graph,
  type WorkflowV2Kind,
} from "./types";

export const V2_RUN_LABELS = {
  queued: "排队中",
  running: "执行中",
  retrying: "等待重试",
  succeeded: "已完成",
  failed: "执行失败",
  cancelled: "已取消",
};
export const V2_NODE_STATUS_LABELS = {
  queued: "等待执行",
  running: "执行中",
  retrying: "等待重试",
  succeeded: "完成",
  failed: "失败",
  cancelled: "已取消",
  skipped: "已跳过",
};

export function nodeRunLabel(node: WorkflowNodeRun, graph?: WorkflowV2Graph) {
  return (
    graph?.nodes.find((item) => item.id === node.nodeId)?.data.title ||
    NODE_LABELS[String(node.nodeType) as WorkflowV2Kind] ||
    String(node.nodeType)
  );
}

/** 只展示服务端实际报告的进度，缺失或非法值不估算生成百分比。 */
export function reportedProgress(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(Math.max(0, Math.min(1, value)) * 100)
    : null;
}

export function elapsedSeconds(start: string | null, finish: string | null, now: number): number {
  if (!start) return 0;
  const end = finish ? Date.parse(finish) : now;
  const seconds = (end - Date.parse(start)) / 1000;
  return Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
}

export function formatDuration(seconds: number): string {
  return seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

/** 总体条代表节点处理进度，不代表某个远程模型的生成进度。 */
export function runSummary(run: WorkflowRun) {
  const active = run.status === "queued" || run.status === "running";
  const completed = run.nodes.filter((node) => node.status === "succeeded").length;
  const skipped = run.nodes.filter((node) => node.status === "skipped").length;
  const settled = run.nodes.filter(
    (node) => node.status !== "queued" && node.status !== "running" && node.status !== "retrying",
  ).length;
  const current = active
    ? run.nodes.find((node) => node.status === "running" || node.status === "retrying")
    : undefined;
  const partial = active
    ? run.nodes.reduce(
        (sum, node) =>
          sum +
          (node.status === "running" || node.status === "retrying"
            ? (reportedProgress(node.progress) ?? 0) / 100
            : 0),
        0,
      )
    : 0;
  const progress = run.nodes.length
    ? Math.min(100, Math.round(((settled + partial) / run.nodes.length) * 100))
    : 0;
  return { active, completed, skipped, settled, current, progress, total: run.nodes.length };
}

/** 连线仅作呈现装饰；从不改变原图、控制边条件或持久化节点状态。 */
export function executionEdges(graph: WorkflowV2Graph, run: WorkflowRun | null): Edge[] {
  const running = run?.status === "running";
  const byId = new Map(run?.nodes.map((node) => [node.nodeId, node]));
  return graph.edges.map((edge) => {
    const source = byId.get(edge.source),
      target = byId.get(edge.target);
    const control = edge.targetHandle === CONTROL_PORT;
    const route = source?.output?.fields?.route;
    const rejected = control && route !== undefined && route !== edge.sourceHandle;
    const skipped = rejected || source?.status === "skipped" || target?.status === "skipped";
    const active = Boolean(
      running && !skipped && source?.status === "succeeded" && target?.status === "running",
    );
    const done = !skipped && source?.status === "succeeded" && target?.status === "succeeded";
    const failed = !skipped && target?.status === "failed";
    const stroke = skipped
      ? "var(--muted-foreground)"
      : active
        ? "var(--primary)"
        : failed
          ? "var(--destructive)"
          : done
            ? "var(--success)"
            : control
              ? "#d97706"
              : "var(--muted-foreground)";
    const sourceNode = graph.nodes.find((node) => node.id === edge.source);
    return {
      ...edge,
      animated: active,
      className: active ? "v2-edge-running" : undefined,
      label: control
        ? sourceNode &&
          branchPorts(sourceNode.data).find((port) => port.key === edge.sourceHandle)?.label
        : edge.label,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: stroke },
      style: {
        ...edge.style,
        stroke,
        strokeWidth: active ? 2.5 : done ? 2 : 1.5,
        opacity: skipped ? 0.35 : 1,
        strokeDasharray: skipped ? "5 5" : undefined,
      },
    };
  });
}
