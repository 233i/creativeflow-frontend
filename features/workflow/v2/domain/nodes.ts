import type { Edge, Node } from "@xyflow/react";
import type { WorkflowField } from "./fields";
import type { HttpNodeRequest } from "../http-types";

export interface TransformExpression {
  op: string;
  input?: string;
  path?: string;
  value?: unknown;
  args?: TransformExpression[];
  properties?: Record<string, TransformExpression>;
  separator?: string;
}
export interface IntentCategory {
  key: string;
  label: string;
  description: string;
}
export type PromptSegment = { text: string } | { input: string };
export interface BranchRule {
  input: string;
  operator: string;
  value?: string | number | boolean;
}
export interface BranchCase {
  key: string;
  label?: string;
  match: "all" | "any";
  conditions: BranchRule[];
}
export interface NodeConfiguration {
  title?: string;
  fields: WorkflowField[];
  modelId?: string;
  systemPrompt?: string;
  prompt?: PromptSegment[];
  maxOutputTokens?: number;
  temperature?: number;
  timeoutSeconds?: number;
  libraryId?: string;
  versionId?: string;
  topK?: number;
  maxContextChunks?: number;
  minScore?: number;
  retrievalMode?: "vector" | "keyword" | "hybrid";
  denseCandidates?: number;
  keywordCandidates?: number;
  rerankCandidates?: number;
  minRerankScore?: number;
  neighborRadius?: number;
  exactMatch?: "prefer" | "require" | "off";
  rerankModelId?: string;
  rerankFailurePolicy?: "fail" | "fallback";
  cases?: BranchCase[];
  http?: HttpNodeRequest;
  extract?: Record<string, string>;
  credentialId?: string;
  credentialRevisionId?: string;
  responseMode?: "full" | "fields";
  outputFields?: WorkflowField[];
  outputMode?: "text" | "json";
  outputTransport?: "prompt" | "json_schema";
  intents?: IntentCategory[];
  assignments?: { key: string; expression: TransformExpression }[];
  language?: "python" | "javascript";
  code?: string;
  body?: WorkflowV2Graph;
  maxItems?: number;
  parallelism?: number;
  batchSize?: number;
  failurePolicy?: "failFast" | "continue";
  retry?: { maxAttempts: number; backoffMs: number; maxBackoffMs: number; retryOn?: string[] };
}
export type WorkflowV2Kind =
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
  | "script"
  | "loop"
  | "batch";

export type ModelNodeKind = "llm" | "knowledgeAnswer" | "parameterExtract" | "intentClassify";
export type BranchNodeKind = "condition" | "intentClassify";
type CommonKeys = "fields" | "title";
type ModelKeys = "modelId" | "systemPrompt" | "maxOutputTokens" | "temperature" | "timeoutSeconds";
type PromptKeys = ModelKeys | "prompt" | "outputTransport";
type LoopKeys =
  "body" | "maxItems" | "parallelism" | "batchSize" | "failurePolicy" | "outputFields" | "retry";
type ConfigurationKeys = {
  start: never;
  end: never;
  merge: never;
  llm: PromptKeys | "outputMode" | "outputFields";
  knowledgeRetrieve:
    | "libraryId"
    | "versionId"
    | "topK"
    | "maxContextChunks"
    | "minScore"
    | "retrievalMode"
    | "denseCandidates"
    | "keywordCandidates"
    | "rerankCandidates"
    | "minRerankScore"
    | "neighborRadius"
    | "exactMatch"
    | "rerankModelId"
    | "rerankFailurePolicy";
  knowledgeAnswer: ModelKeys;
  condition: "cases";
  httpRequest:
    "http" | "extract" | "credentialId" | "credentialRevisionId" | "responseMode" | "outputFields";
  parameterExtract: PromptKeys | "outputFields";
  intentClassify: PromptKeys | "intents";
  transform: "outputFields" | "assignments";
  script: "outputFields" | "language" | "code" | "timeoutSeconds";
  loop: LoopKeys;
  batch: LoopKeys;
};

export type NodeConfigurationKeys<K extends WorkflowV2Kind> = CommonKeys | ConfigurationKeys[K];

/** 草稿配置可以未填写；已知配置项仍必须属于对应节点种类。扩展字段保留 unknown。 */
export type WorkflowV2NodeDataMap = {
  [K in WorkflowV2Kind]: Record<string, unknown> &
    Pick<NodeConfiguration, CommonKeys | ConfigurationKeys[K] | "retry"> & {
      [P in Exclude<keyof NodeConfiguration, CommonKeys | ConfigurationKeys[K] | "retry">]?: never;
    };
};
export type WorkflowV2NodeData<K extends WorkflowV2Kind = WorkflowV2Kind> =
  WorkflowV2NodeDataMap[K];
export type WorkflowV2Node<K extends WorkflowV2Kind = WorkflowV2Kind> = {
  [P in K]: Node<WorkflowV2NodeDataMap[P], P> & { type: P };
}[K];
export interface WorkflowV2Graph {
  schemaVersion: 1;
  nodes: WorkflowV2Node[];
  edges: Edge[];
}
