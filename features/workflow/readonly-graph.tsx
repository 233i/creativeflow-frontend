"use client";

import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useEffect, useMemo } from "react";
import type { WorkflowGraph, WorkflowRun, WorkflowPartialRerunPreview } from "./types";
import { statusLabel } from "./presentation/run-status";
import "@xyflow/react/dist/style.css";

const nodeNames: Record<string, string> = {
  text: "文本输入",
  image: "图片输入",
  imageGenerate: "图片生成",
  videoGenerate: "视频生成",
  videoExtend: "视频延长",
  videoFrame: "提取尾帧",
  imageOutput: "图片结果",
  videoOutput: "视频结果",
  output: "输出",
  start: "开始",
  end: "结束",
  llm: "LLM",
  knowledgeRetrieve: "知识检索",
  knowledgeAnswer: "知识问答",
  condition: "条件分支",
  merge: "结果汇合",
  httpRequest: "HTTP 请求",
};
export function snapshotNodeName(node: WorkflowGraph["nodes"][number]): string {
  return typeof node.data.title === "string" && node.data.title
    ? node.data.title
    : typeof node.data.label === "string" && node.data.label
      ? node.data.label
      : ((
          {
            parameterExtract: "参数提取",
            intentClassify: "意图分类",
            transform: "变量处理",
          } as Record<string, string>
        )[node.type ?? ""] ??
        nodeNames[node.type ?? ""] ??
        node.type ??
        node.id);
}

type SnapshotNode = Node<
  {
    label: string;
    kind: string;
    status?: string;
    preview?: string;
    sourceHandles: string[];
    targetHandles: string[];
  },
  "snapshot"
>;
const nodeTypes = { snapshot: SnapshotCard };

/** 历史图只展示原始 ID、位置和连线，不复用可写节点组件或写入当前画布 store。 */
export function ReadonlyWorkflowGraph({
  graph,
  run,
  selectedId,
  onSelect,
  preview,
}: {
  graph: WorkflowGraph;
  run?: WorkflowRun | null;
  selectedId?: string;
  onSelect?: (id: string) => void;
  preview?: WorkflowPartialRerunPreview;
}) {
  const nodes = useMemo<SnapshotNode[]>(
    () =>
      graph.nodes.map((node) => ({
        id: node.id,
        type: "snapshot",
        position: node.position,
        selected: selectedId === node.id,
        data: {
          label: snapshotNodeName(node),
          kind: node.type ?? "未知节点",
          status: run?.nodes.find((item) => item.nodeId === node.id)?.status,
          preview: preview
            ? preview.fromNodeId === node.id
              ? "重跑起点"
              : preview.rerunNodeIds.includes(node.id)
                ? "将重跑"
                : preview.reusedNodeIds.includes(node.id)
                  ? "复用"
                  : undefined
            : undefined,
          sourceHandles: [
            ...new Set(
              graph.edges
                .filter((edge) => edge.source === node.id)
                .map((edge) => edge.sourceHandle ?? ""),
            ),
          ],
          targetHandles: [
            ...new Set(
              graph.edges
                .filter((edge) => edge.target === node.id)
                .map((edge) => edge.targetHandle ?? ""),
            ),
          ],
        },
      })),
    [graph, run, selectedId, preview],
  );
  const edges = useMemo(
    () =>
      graph.edges.map((edge) => ({
        ...edge,
        type: "default",
        selected: false,
        animated: run?.nodes.find((node) => node.nodeId === edge.target)?.status === "running",
      })),
    [graph, run],
  );
  return (
    <div className="relative h-full min-h-80 min-w-0 bg-canvas" aria-label="只读工作流快照">
      <ReactFlow<SnapshotNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        deleteKeyCode={null}
        onNodeClick={(_, node) => onSelect?.(node.id)}
        fitView
        fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
        minZoom={0.1}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
        <FocusHistoricalNode selectedId={selectedId} />
      </ReactFlow>
    </div>
  );
}

/** 等原图节点测量完成后定位；轮询更新输出不反复重置用户缩放。 */
function FocusHistoricalNode({ selectedId }: { selectedId?: string }) {
  const initialized = useNodesInitialized();
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (initialized && selectedId)
      void fitView({ nodes: [{ id: selectedId }], padding: 0.5, maxZoom: 1, duration: 180 });
  }, [initialized, selectedId, fitView]);
  return null;
}

function SnapshotCard({ id, data, selected }: NodeProps<SnapshotNode>) {
  return (
    <section
      className={`w-60 rounded-xl border bg-card shadow-sm ${selected ? "ring-2 ring-primary" : ""} ${data.preview === "复用" ? "border-success bg-success/5" : data.preview ? "border-dashed border-warning bg-warning/5" : data.status === "failed" ? "border-destructive" : data.status === "running" ? "border-primary" : data.status === "succeeded" ? "border-success" : ""}`}
    >
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5 text-sm">
        <strong className="truncate">{data.label}</strong>
        <span className="shrink-0 text-xs">
          {data.preview ?? (data.status ? statusLabel(data.status) : "只读")}
        </span>
      </header>
      <div className="space-y-1 p-3 text-xs text-muted-foreground">
        <p>{data.kind}</p>
        <p className="truncate font-mono" title={id}>
          {id}
        </p>
      </div>
      {data.targetHandles.map((handle, index) => (
        <Handle
          key={handle}
          id={handle || undefined}
          type="target"
          position={Position.Left}
          isConnectable={false}
          style={{ top: `${((index + 1) / (data.targetHandles.length + 1)) * 100}%` }}
        />
      ))}
      {data.sourceHandles.map((handle, index) => (
        <Handle
          key={handle}
          id={handle || undefined}
          type="source"
          position={Position.Right}
          isConnectable={false}
          style={{ top: `${((index + 1) / (data.sourceHandles.length + 1)) * 100}%` }}
        />
      ))}
    </section>
  );
}
