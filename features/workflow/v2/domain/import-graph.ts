import { canConnect } from "./connections";
import type { WorkflowV2Graph } from "./nodes";
import { isRecord, parseWorkflowNode } from "./node-validation";
import { snapshotGraph } from "./snapshot";

function parseEdge(edge: unknown, ids: Set<string>): WorkflowV2Graph["edges"][number] {
  if (
    !isRecord(edge) ||
    typeof edge.id !== "string" ||
    !edge.id.trim() ||
    ids.has(edge.id) ||
    typeof edge.source !== "string" ||
    typeof edge.target !== "string" ||
    typeof edge.sourceHandle !== "string" ||
    typeof edge.targetHandle !== "string"
  )
    throw new Error("连线标识或端口无效。");
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
  };
}

/** 导入只接受可持久化图；节点配置允许草稿，执行完整性与授权仍由运行入口和服务端负责。 */
export function parseWorkflowGraph(value: unknown): WorkflowV2Graph {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges)
  )
    throw new Error("工作流图的版本或节点结构无效。");
  if (value.nodes.length > 40 || value.edges.length > 100)
    throw new Error("工作流不能超过 40 个节点、100 条连线。");
  const nodes = value.nodes.map(parseWorkflowNode);
  if (new Set(nodes.map((node) => node.id)).size !== nodes.length)
    throw new Error("节点 ID 重复。");
  const graph: WorkflowV2Graph = { schemaVersion: 1, nodes, edges: [] };
  const ids = new Set<string>();
  for (const edge of value.edges) {
    const connection = parseEdge(edge, ids);
    if (!canConnect(graph, connection))
      throw new Error(`连线 ${connection.id} 类型不匹配、重复或形成循环。`);
    graph.edges.push(connection);
    ids.add(connection.id);
  }
  return snapshotGraph(graph);
}
