import { isWorkflowV2Kind } from "./v2/domain/node-definitions";
import type { Edge, Node } from "@xyflow/react";
import type { WorkflowV2NodeData } from "./v2/types";

export type WorkflowNodeKind =
  | "start"
  | "llm"
  | "knowledgeRetrieve"
  | "knowledgeAnswer"
  | "condition"
  | "merge"
  | "httpRequest"
  | "end"
  | "parameterExtract"
  | "intentClassify"
  | "transform"
  | "text"
  | "image"
  | "imageGenerate"
  | "videoGenerate"
  | "videoExtend"
  | "videoFrame"
  | "imageOutput"
  | "videoOutput"
  | "output";

export type WorkflowPortType = "text" | "image" | "video";

export type WorkflowExternalInputType = "string" | "image" | "integer" | "boolean" | "enum";

export interface WorkflowExternalInputConstraints {
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  values?: string[];
}

export interface WorkflowExternalInputBinding {
  key: string;
  label: string;
  description: string;
  type: WorkflowExternalInputType;
  required: boolean;
  default?: string | number | boolean | { assetId: string } | null;
  target: { nodeId: string; field: string };
  constraints?: WorkflowExternalInputConstraints;
}

export interface WorkflowExternalOutputBinding {
  key: string;
  label: string;
  type: "image" | "video";
  nodeId: string;
}

export interface WorkflowExternalApiManifest {
  schemaVersion: 1;
  inputs: WorkflowExternalInputBinding[];
  outputs: WorkflowExternalOutputBinding[];
}

export interface WorkflowExternalBindingTarget {
  kind: "input" | "output";
  nodeId: string;
  nodeType: WorkflowNodeKind;
  field?: string;
  type: WorkflowExternalInputType | "image" | "video";
  label: string;
  constraints?: WorkflowExternalInputConstraints;
}

export interface TextWorkflowNodeData {
  text: string;
}

export interface ImageWorkflowNodeData {
  assetUrl?: string;
  mediaType?: string;
}

export interface ImageGenerateWorkflowNodeData {
  /** 图片创作节点固定使用的后台已启用模型；缺省时使用图片默认槽位或唯一可用模型。 */
  providerId?: string;
  modelId?: string;
  aspect?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3";
  count?: number;
  quality?: "auto" | "low" | "medium" | "high";
  outputFormat?: "png" | "jpeg" | "webp";
  seed?: number;
}

export interface VideoGenerateWorkflowNodeData {
  /** 生成视频的画面比例。 */
  aspect?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3";
  /** 保存的分辨率档位，由所选协议映射为上游取值。 */
  resolution?: "480p" | "720p" | "1080p";
  /** 视频时长，单位为秒。 */
  duration?: number;
  /** 支持种子的模型所使用的随机种子。 */
  seed?: number;
  /** 支持水印的模型是否请求添加水印。 */
  watermark?: boolean;
  /** 支持音频生成的模型是否请求生成音轨。 */
  generateAudio?: boolean;
  /** 支持双模式的模型可选择参考图片或首尾帧；缺省沿用参考图模式。 */
  inputMode?: "reference" | "first-last";
  /** 仅首尾帧模式生效；缺省按原有连线顺序，true 时交换两张图片的角色。 */
  reverseFrames?: boolean;
}

export interface VideoFrameWorkflowNodeData {
  frame?: "last";
}

export interface VideoExtendWorkflowNodeData {
  duration?: number;
}

export type OutputWorkflowNodeData = Record<string, never>;

export type WorkflowNodeData =
  | WorkflowV2NodeData
  | TextWorkflowNodeData
  | ImageWorkflowNodeData
  | ImageGenerateWorkflowNodeData
  | VideoGenerateWorkflowNodeData
  | VideoExtendWorkflowNodeData
  | VideoFrameWorkflowNodeData
  | OutputWorkflowNodeData;

export type WorkflowNode = Node<WorkflowNodeData & Record<string, unknown>>;
export type WorkflowEdge = Edge;

export interface WorkflowGraph {
  schemaVersion?: 1;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  externalApi?: WorkflowExternalApiManifest;
}

/** 类型化节点与媒体节点共用 schema 1；节点词汇决定编辑器和运行能力。 */
export function isTypedWorkflowGraph(graph: WorkflowGraph | null | undefined): boolean {
  return !!graph?.nodes.some((node) => isWorkflowV2Kind(node.type));
}

export const WORKFLOW_NODE_SIZE: Record<WorkflowNodeKind, { width: number; height: number }> = {
  start: { width: 280, height: 220 },
  llm: { width: 280, height: 300 },
  knowledgeRetrieve: { width: 280, height: 280 },
  knowledgeAnswer: { width: 280, height: 320 },
  condition: { width: 280, height: 260 },
  merge: { width: 280, height: 260 },
  httpRequest: { width: 280, height: 340 },
  end: { width: 280, height: 220 },
  parameterExtract: { width: 280, height: 300 },
  intentClassify: { width: 280, height: 300 },
  transform: { width: 280, height: 300 },
  text: { width: 280, height: 180 },
  image: { width: 280, height: 260 },
  imageGenerate: { width: 280, height: 340 },
  videoGenerate: { width: 280, height: 410 },
  videoExtend: { width: 280, height: 250 },
  videoFrame: { width: 280, height: 160 },
  imageOutput: { width: 340, height: 280 },
  videoOutput: { width: 380, height: 300 },
  output: { width: 340, height: 280 },
};

export const WORKFLOW_ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"] as const;

export const VIDEO_EXTENSION_DURATION_MIN = 2;
export const VIDEO_EXTENSION_DURATION_MAX = 10;
export const VIDEO_EXTENSION_DURATION_DEFAULT = 6;

export type WorkflowRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type WorkflowNodeRunStatus = WorkflowRunStatus | "retrying" | "skipped";

export interface WorkflowNodeOutput {
  modelCall?: WorkflowModelCall;
  schemaVersion?: 1;
  fields?: Record<string, unknown>;
  texts?: string[];
  images?: string[];
  videos?: string[];
}

export interface WorkflowNodeRun {
  nodeId: string;
  nodeType: WorkflowNodeKind;
  status: WorkflowNodeRunStatus;
  isReused: boolean;
  progress: number | null;
  output: WorkflowNodeOutput | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  attempt?: number;
  maxAttempts?: number;
  retryAt?: string | null;
  skipReason?: string | null;
}

export interface WorkflowRun {
  debugNodeId?: string | null;
  id: string;
  workflowId: string;
  resumedFromRunId: string | null;
  status: WorkflowRunStatus;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  nodes: WorkflowNodeRun[];
}

/** 服务端持久化的真实调用收据，缺少 usage 表示未知，不能以估算值替代。 */
export interface WorkflowModelCall {
  id: string;
  nodeId: string;
  modelId: string;
  modelKey: string;
  modelName: string;
  providerId: string;
  providerName: string;
  protocol: string;
  status: "requesting" | "completed" | "failed" | "unknown";
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  httpStatus?: number | null;
  upstreamRequestId?: string | null;
  finishReason?: string | null;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  outputMode: string;
  transport?: string;
  maxOutputTokens?: number;
  temperature?: number;
  candidateCount?: number;
  errorCode?: string | null;
  error?: string | null;
}

export interface WorkflowPartialRerunPreview {
  sourceRunId: string;
  fromNodeId: string;
  reusedNodeIds: string[];
  rerunNodeIds: string[];
}

export interface WorkflowRunChangedEvent {
  workflowId: string;
  runId: string;
  status: WorkflowRunStatus;
  nodeId: string | null;
  nodeStatus: WorkflowNodeRunStatus | null;
  progress: number | null;
  output: WorkflowNodeOutput | null;
  error: string | null;
}

export function nodeKind(node: WorkflowNode): WorkflowNodeKind {
  return (node.type ?? "text") as WorkflowNodeKind;
}
