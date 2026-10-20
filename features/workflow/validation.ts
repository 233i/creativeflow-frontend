import type { Connection } from "@xyflow/react";
import type {
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeKind,
  WorkflowPortType,
} from "@/features/workflow/types";
import { nodeKind } from "@/features/workflow/types";
import { workflowVideoImages } from "@/features/workflow/video-inputs";

export type WorkflowValidationCode =
  | "empty"
  | "tooManyNodes"
  | "missingOutput"
  | "cycle"
  | "invalidConnection"
  | "missingInput"
  | "emptyText"
  | "missingImage"
  | "missingVideoExtensionModel"
  | "tooManyVideoFrames";

export interface WorkflowValidationIssue {
  code: WorkflowValidationCode;
  nodeId?: string;
}

export function sourcePort(kind: WorkflowNodeKind, handle: string | null): WorkflowPortType | null {
  if (kind === "text" && handle === "text") return "text";
  if (
    (kind === "image" || kind === "imageGenerate" || kind === "imageOutput") &&
    handle === "image"
  )
    return "image";
  if (kind === "videoFrame" && handle === "image") return "image";
  if (
    (kind === "videoGenerate" || kind === "videoExtend" || kind === "videoOutput") &&
    handle === "video"
  )
    return "video";
  return null;
}

export function targetPort(kind: WorkflowNodeKind, handle: string | null): WorkflowPortType | null {
  if (
    (kind === "imageGenerate" || kind === "videoGenerate" || kind === "videoExtend") &&
    handle === "prompt"
  )
    return "text";
  if (
    (kind === "imageGenerate" ||
      kind === "videoGenerate" ||
      kind === "imageOutput" ||
      kind === "output") &&
    handle === "image"
  )
    return "image";
  if ((kind === "videoExtend" || kind === "videoOutput" || kind === "output") && handle === "video")
    return "video";
  if (kind === "videoFrame" && handle === "video") return "video";
  return null;
}

export function isValidWorkflowConnection(
  connection: Connection | WorkflowEdge,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): boolean {
  if (!connection.source || !connection.target || connection.source === connection.target)
    return false;
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  if (!source || !target) return false;

  const from = sourcePort(nodeKind(source), connection.sourceHandle ?? null);
  const to = targetPort(nodeKind(target), connection.targetHandle ?? null);
  if (!from || from !== to) return false;

  const duplicate = edges.some(
    (edge) =>
      edge.source === connection.source &&
      edge.target === connection.target &&
      (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null) &&
      (edge.targetHandle ?? null) === (connection.targetHandle ?? null),
  );
  return !duplicate && !wouldCreateCycle(connection.source, connection.target, edges);
}

/** 检查图结构与已知输入；动态生成素材仍由执行端校验实际数量。 */
export function validateWorkflow(
  graph: WorkflowGraph,
  options: { videoExtensionSupported?: boolean } = {},
): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  if (graph.nodes.length === 0) return [{ code: "empty" }];
  if (graph.nodes.length > 40) issues.push({ code: "tooManyNodes" });
  if (!graph.nodes.some((node) => isOutputKind(nodeKind(node)))) {
    issues.push({ code: "missingOutput" });
  }

  for (const node of graph.nodes) {
    const kind = nodeKind(node);
    const inputs = graph.edges.filter((edge) => edge.target === node.id);
    // 已上传图片可提前确定数量；生成节点的实际输出数量交给后端在视频提交前判断。
    if (
      kind === "videoGenerate" &&
      node.data.inputMode === "first-last" &&
      workflowVideoImages(node.id, graph.nodes, graph.edges).filter((image) => !image.pending)
        .length > 2
    ) {
      issues.push({ code: "tooManyVideoFrames", nodeId: node.id });
    }
    if (kind === "text" && !(node.data as { text?: string }).text?.trim()) {
      issues.push({ code: "emptyText", nodeId: node.id });
    }
    if (kind === "image" && !(node.data as { assetUrl?: string }).assetUrl) {
      issues.push({ code: "missingImage", nodeId: node.id });
    }
    if (kind === "videoExtend") {
      const hasPrompt = inputs.some((edge) => edge.targetHandle === "prompt");
      const videoInputs = inputs.filter((edge) => edge.targetHandle === "video");
      if (!hasPrompt || videoInputs.length !== 1) {
        issues.push({ code: "missingInput", nodeId: node.id });
      }
      if (options.videoExtensionSupported === false) {
        issues.push({ code: "missingVideoExtensionModel", nodeId: node.id });
      }
    } else if (
      (kind === "imageGenerate" ||
        kind === "videoGenerate" ||
        kind === "videoFrame" ||
        isOutputKind(kind)) &&
      inputs.length === 0
    ) {
      issues.push({ code: "missingInput", nodeId: node.id });
    }
  }

  if (containsCycle(graph.nodes, graph.edges)) issues.push({ code: "cycle" });

  for (const edge of graph.edges) {
    const source = graph.nodes.find((node) => node.id === edge.source);
    const target = graph.nodes.find((node) => node.id === edge.target);
    const from = source ? sourcePort(nodeKind(source), edge.sourceHandle ?? null) : null;
    const to = target ? targetPort(nodeKind(target), edge.targetHandle ?? null) : null;
    if (!source || !target || !from || !to || from !== to) {
      issues.push({ code: "invalidConnection" });
      break;
    }
  }

  return issues;
}

function isOutputKind(kind: WorkflowNodeKind): boolean {
  return kind === "imageOutput" || kind === "videoOutput" || kind === "output";
}

function wouldCreateCycle(source: string, target: string, edges: WorkflowEdge[]): boolean {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }

  const stack = [target];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === source) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(outgoing.get(current) ?? []));
  }
  return false;
}

function containsCycle(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of edges) {
    if (!incoming.has(edge.target) || !outgoing.has(edge.source)) continue;
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)!.push(edge.target);
  }

  const ready = [...incoming.entries()].filter(([, count]) => count === 0).map(([id]) => id);
  let visited = 0;
  while (ready.length > 0) {
    const id = ready.pop()!;
    visited += 1;
    for (const target of outgoing.get(id) ?? []) {
      const next = (incoming.get(target) ?? 1) - 1;
      incoming.set(target, next);
      if (next === 0) ready.push(target);
    }
  }
  return visited !== nodes.length;
}
