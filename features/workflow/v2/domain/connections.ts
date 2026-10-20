import type { Edge } from "@xyflow/react";
import type { WorkflowField } from "./fields";
import type { WorkflowV2Graph, WorkflowV2Node } from "./nodes";
import {
  CONTROL_PORT,
  branchPorts,
  isBranch,
  outputFields,
  inputFields,
  NODE_DEFINITIONS,
} from "./node-definitions";

export type WorkflowConnection = Pick<Edge, "source" | "target" | "sourceHandle" | "targetHandle">;

/** 只判断端口契约；重复来源与环由图规则处理。 */
export function compatibleFields(
  output: WorkflowField | undefined,
  input: WorkflowField | undefined,
): boolean {
  return (
    !!output &&
    !!input &&
    output.type === input.type &&
    (!input.required || output.required || Object.hasOwn(output, "default"))
  );
}

export function compatiblePorts(
  source: WorkflowV2Node,
  target: WorkflowV2Node,
  edge: WorkflowConnection,
): boolean {
  if (source.id === target.id || target.type === "start") return false;
  if (edge.targetHandle === CONTROL_PORT) {
    return (
      isBranch(source.type) &&
      NODE_DEFINITIONS[target.type].acceptsControl &&
      branchPorts(source.data).some((port) => port.key === edge.sourceHandle)
    );
  }
  return compatibleFields(
    outputFields(source).find((field) => field.key === edge.sourceHandle),
    inputFields(target).find((field) => field.key === edge.targetHandle),
  );
}

/** 控制端口和普通输入最多一个来源；汇合输入允许不同来源。 */
function hasConflictingSource(
  edges: Edge[],
  target: WorkflowV2Node,
  edge: WorkflowConnection,
): boolean {
  return edges.some(
    (item) =>
      item.target === edge.target &&
      item.targetHandle === edge.targetHandle &&
      (edge.targetHandle === CONTROL_PORT ||
        target.type !== "merge" ||
        (item.source === edge.source && item.sourceHandle === edge.sourceHandle)),
  );
}

function createsCycle(edges: Edge[], edge: WorkflowConnection): boolean {
  const descendants = new Set<string>();
  const pending = [edge.target];
  while (pending.length) {
    const id = pending.pop()!;
    if (id === edge.source) return true;
    if (descendants.has(id)) continue;
    descendants.add(id);
    for (const item of edges) if (item.source === id) pending.push(item.target);
  }
  return false;
}

/** 创建、导入和清理都按端口、来源数量、无环三个规则检查。 */
export function canConnect(graph: WorkflowV2Graph, edge: WorkflowConnection): boolean {
  const source = graph.nodes.find((node) => node.id === edge.source);
  const target = graph.nodes.find((node) => node.id === edge.target);
  return (
    !!source &&
    !!target &&
    compatiblePorts(source, target, edge) &&
    !hasConflictingSource(graph.edges, target, edge) &&
    !createsCycle(graph.edges, edge)
  );
}

/** 按原顺序保留有效连线；冲突或环保留先出现者，完整有效图保持引用不变。 */
export function pruneInvalidEdges(graph: WorkflowV2Graph): WorkflowV2Graph {
  const accepted: Edge[] = [];
  for (const edge of graph.edges) {
    try {
      if (canConnect({ ...graph, edges: accepted }, edge)) accepted.push(edge);
    } catch {
      // 旧草稿可能含有不完整的节点配置；对应连线不能继续保留。
    }
  }
  return accepted.length === graph.edges.length ? graph : { ...graph, edges: accepted };
}
