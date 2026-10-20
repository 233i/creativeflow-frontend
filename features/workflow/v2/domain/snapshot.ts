import type { WorkflowV2Graph, WorkflowV2Node } from "./nodes";
import { createWorkflowNode } from "./node-definitions";

/** 输入已经是关联 type/data 的节点；投影只移除编辑器元数据。 */
function snapshotNode<N extends WorkflowV2Node>(node: N): N {
  const { id, type, data, position } = node;
  return { id, type, data, position } as N;
}

/** 显式创建新版图；从不升级、复制或改写旧媒体工作流。 */
export function createV2Workflow(): WorkflowV2Graph {
  const nodes = (["start", "llm", "end"] as const).map((type, index) =>
    createWorkflowNode(type, crypto.randomUUID(), { x: index * 360, y: 100 }),
  );
  return {
    schemaVersion: 1,
    nodes,
    edges: [
      {
        id: crypto.randomUUID(),
        source: nodes[0].id,
        sourceHandle: "question",
        target: nodes[1].id,
        targetHandle: "question",
      },
      {
        id: crypto.randomUUID(),
        source: nodes[1].id,
        sourceHandle: "text",
        target: nodes[2].id,
        targetHandle: "answer",
      },
    ],
  };
}

/** 保存时去掉 React Flow 的选择、测量和运行装饰，只保留业务数据。 */
export function snapshotGraph(graph: WorkflowV2Graph): WorkflowV2Graph {
  return {
    schemaVersion: 1,
    nodes: graph.nodes.map(snapshotNode),
    edges: graph.edges.map(({ id, source, sourceHandle, target, targetHandle }) => ({
      id,
      source,
      sourceHandle,
      target,
      targetHandle,
    })),
  };
}
