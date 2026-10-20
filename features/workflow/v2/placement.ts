import {
  NODE_DEFINITIONS,
  createWorkflowNode,
  type WorkflowV2Graph,
  type WorkflowV2Kind,
} from "./types";

/** 自有拖放格式只携带节点种类，不接受从页面外部注入节点配置、凭据或现成连线。 */
export const NODE_DRAG_MIME = "application/x-creativeflow-v2-node";

export function droppedKind(
  value: string,
  allowed: readonly WorkflowV2Kind[],
): WorkflowV2Kind | null {
  return allowed.find((kind) => kind === value) ?? null;
}

/** 开始/结束保持原 ID 与连线；其他节点使用全新默认配置，在真实画布坐标创建。 */
export function placeNode(
  graph: WorkflowV2Graph,
  kind: WorkflowV2Kind,
  position: { x: number; y: number },
  newId: string,
): { graph: WorkflowV2Graph; nodeId: string } {
  if (
    ![position.x, position.y].every(
      (value) => Number.isFinite(value) && Math.abs(value) <= 1_000_000,
    )
  )
    throw new Error("节点位置超出画布范围。");
  const existing = NODE_DEFINITIONS[kind].singleton
    ? graph.nodes.find((node) => node.type === kind)
    : undefined;
  if (existing)
    return {
      graph: {
        ...graph,
        nodes: graph.nodes.map((node) => (node.id === existing.id ? { ...node, position } : node)),
      },
      nodeId: existing.id,
    };
  if (graph.nodes.length >= 40) throw new Error("工作流最多包含 40 个节点。");
  if (graph.nodes.some((node) => node.id === newId)) throw new Error("节点标识重复，请重试。");
  return {
    graph: {
      ...graph,
      nodes: [...graph.nodes, createWorkflowNode(kind, newId, position)],
    },
    nodeId: newId,
  };
}
