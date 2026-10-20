import { defaultHttpRequest, httpOutputFields } from "../http-types";
import { DEFAULT_CONTEXT_CHUNKS } from "../knowledge-limits";
import type { WorkflowField } from "./fields";
import type {
  BranchNodeKind,
  ModelNodeKind,
  NodeConfigurationKeys,
  WorkflowV2Kind,
  WorkflowV2Node,
  WorkflowV2NodeData,
  WorkflowV2Graph,
} from "./nodes";

export const CONTROL_PORT = "$flow";
export const TEXT_OUTPUT: WorkflowField[] = [
  { key: "text", label: "生成文本", type: "string", required: true, maxLength: 16000 },
];
export type NodeGroup = "输入与输出" | "流程控制" | "数据处理" | "模型与工具";

function defaultLoopBody(batch: boolean): WorkflowV2Graph {
  const sourceKey = batch ? "items" : "item";
  const sourceType: "array" | "object" = batch ? "array" : "object";
  return {
    schemaVersion: 1,
    nodes: [
      {
        id: "body-start",
        type: "start",
        position: { x: 0, y: 0 },
        data: {
          fields: [
            { key: sourceKey, label: batch ? "批次" : "当前项", type: sourceType, required: true },
            { key: "index", label: "索引", type: "number", required: true },
          ],
        },
      },
      {
        id: "body-end",
        type: "end",
        position: { x: 360, y: 0 },
        data: {
          fields: [{ key: "result", label: "结果", type: sourceType, required: true }],
        },
      },
    ],
    edges: [
      {
        id: "body-edge",
        source: "body-start",
        sourceHandle: sourceKey,
        target: "body-end",
        targetHandle: "result",
      },
    ],
  };
}

const LOOP_OUTPUTS: WorkflowField[] = [
  {
    key: "results",
    label: "执行结果",
    type: "array",
    required: true,
    items: { key: "item", type: "object", required: true },
  },
  {
    key: "errors",
    label: "失败项",
    type: "array",
    required: true,
    items: { key: "error", type: "string", required: true, maxLength: 1000 },
  },
  { key: "count", label: "数量", type: "number", required: true, integer: true },
];
type NodeDefinition<K extends WorkflowV2Kind> = {
  configuration: Record<NodeConfigurationKeys<K>, true>;
  label: string;
  group: NodeGroup;
  usesModel: K extends ModelNodeKind ? true : false;
  branch: K extends BranchNodeKind ? true : false;
  singleton: boolean;
  acceptsControl: boolean;
  fixedFields: boolean;
  defaults: () => WorkflowV2NodeData<K>;
  inputs: (data: WorkflowV2NodeData<K>) => WorkflowField[];
  outputs: (data: WorkflowV2NodeData<K>) => WorkflowField[];
};

/** 节点默认值、端口和编辑能力的唯一注册表；没有组件或图标依赖。 */
export const NODE_DEFINITIONS: { [K in WorkflowV2Kind]: NodeDefinition<K> } = {
  start: {
    configuration: { fields: true, title: true },
    label: "开始",
    group: "输入与输出",
    usesModel: false,
    branch: false,
    singleton: true,
    acceptsControl: false,
    fixedFields: false,
    defaults: () => ({
      fields: [
        {
          key: "question",
          label: "问题",
          type: "string",
          required: true,
        },
      ],
    }),
    inputs: () => [],
    outputs: (data) => data.fields,
  },
  llm: {
    configuration: {
      fields: true,
      title: true,
      modelId: true,
      systemPrompt: true,
      maxOutputTokens: true,
      temperature: true,
      timeoutSeconds: true,
      prompt: true,
      outputTransport: true,
      outputMode: true,
      outputFields: true,
    },
    label: "LLM",
    group: "模型与工具",
    usesModel: true,
    branch: false,
    singleton: false,
    acceptsControl: true,
    fixedFields: false,
    defaults: () => ({
      fields: [
        {
          key: "question",
          label: "问题",
          type: "string",
          required: true,
        },
      ],
      modelId: "",
      systemPrompt: "请准确、简洁地回答用户的问题。",
      prompt: [
        {
          input: "question",
        },
      ],
      maxOutputTokens: 512,
      temperature: 0.7,
      timeoutSeconds: 120,
    }),
    inputs: (data) => data.fields,
    outputs: (data) => (data.outputMode === "json" ? (data.outputFields ?? []) : TEXT_OUTPUT),
  },
  knowledgeRetrieve: {
    configuration: {
      fields: true,
      title: true,
      libraryId: true,
      versionId: true,
      topK: true,
      maxContextChunks: true,
      minScore: true,
      retrievalMode: true,
      denseCandidates: true,
      keywordCandidates: true,
      rerankCandidates: true,
      minRerankScore: true,
      neighborRadius: true,
      exactMatch: true,
      rerankModelId: true,
      rerankFailurePolicy: true,
    },
    label: "知识检索",
    group: "模型与工具",
    usesModel: false,
    branch: false,
    singleton: false,
    acceptsControl: true,
    fixedFields: true,
    defaults: () => ({
      fields: [
        {
          key: "question",
          type: "string",
          required: true,
        },
        { key: "originalQuestion", type: "string", required: false },
      ],
      libraryId: "",
      versionId: "",
      topK: 4,
      retrievalMode: "hybrid",
      denseCandidates: 32,
      keywordCandidates: 32,
      rerankCandidates: 24,
      neighborRadius: 1,
      exactMatch: "prefer",
      rerankFailurePolicy: "fail",
      minScore: 0,
      maxContextChunks: DEFAULT_CONTEXT_CHUNKS,
    }),
    inputs: (data) => data.fields,
    outputs: () => [{ key: "context", type: "contextChunks", required: true }],
  },
  knowledgeAnswer: {
    configuration: {
      fields: true,
      title: true,
      modelId: true,
      systemPrompt: true,
      maxOutputTokens: true,
      temperature: true,
      timeoutSeconds: true,
    },
    label: "知识问答",
    group: "模型与工具",
    usesModel: true,
    branch: false,
    singleton: false,
    acceptsControl: true,
    fixedFields: true,
    defaults: () => ({
      fields: [
        {
          key: "question",
          type: "string",
          required: true,
        },
        {
          key: "context",
          type: "contextChunks",
          required: true,
        },
      ],
      modelId: "",
      systemPrompt: "用简洁的中文回答。",
      maxOutputTokens: 1024,
      temperature: 0,
      timeoutSeconds: 120,
    }),
    inputs: (data) => data.fields,
    outputs: () => [{ key: "answer", type: "answer", required: true }],
  },
  condition: {
    configuration: { fields: true, title: true, cases: true },
    label: "条件分支",
    group: "流程控制",
    usesModel: false,
    branch: true,
    singleton: false,
    acceptsControl: true,
    fixedFields: false,
    defaults: () => ({
      fields: [
        {
          key: "flag",
          label: "判断值",
          type: "boolean",
          required: true,
        },
      ],
      cases: [
        {
          key: "matched",
          label: "IF · 满足条件",
          match: "all",
          conditions: [
            {
              input: "flag",
              operator: "isTrue",
            },
          ],
        },
      ],
    }),
    inputs: (data) => data.fields,
    outputs: () => [{ key: "route", label: "选中分支", type: "string", required: true }],
  },
  merge: {
    configuration: { fields: true, title: true },
    label: "结果汇合",
    group: "流程控制",
    usesModel: false,
    branch: false,
    singleton: false,
    acceptsControl: true,
    fixedFields: false,
    defaults: () => ({
      fields: [
        {
          key: "result",
          label: "结果",
          type: "string",
          required: true,
        },
      ],
    }),
    inputs: (data) => data.fields,
    outputs: (data) => data.fields,
  },
  httpRequest: {
    configuration: {
      fields: true,
      title: true,
      http: true,
      extract: true,
      credentialId: true,
      credentialRevisionId: true,
      responseMode: true,
      outputFields: true,
    },
    label: "HTTP 请求",
    group: "模型与工具",
    usesModel: false,
    branch: false,
    singleton: false,
    acceptsControl: true,
    fixedFields: false,
    defaults: () => ({
      fields: [
        {
          key: "question",
          label: "输入",
          type: "string",
          required: false,
          default: "",
        },
      ],
      http: defaultHttpRequest(),
      outputFields: [],
      extract: {},
      credentialId: "",
      credentialRevisionId: "",
    }),
    inputs: (data) => data.fields,
    outputs: (data) => httpOutputFields(data),
  },
  end: {
    configuration: { fields: true, title: true },
    label: "结束",
    group: "输入与输出",
    usesModel: false,
    branch: false,
    singleton: true,
    acceptsControl: false,
    fixedFields: false,
    defaults: () => ({
      fields: [
        {
          key: "answer",
          label: "回答",
          type: "string",
          required: true,
        },
      ],
    }),
    inputs: (data) => data.fields,
    outputs: () => [],
  },
  parameterExtract: {
    configuration: {
      fields: true,
      title: true,
      modelId: true,
      systemPrompt: true,
      maxOutputTokens: true,
      temperature: true,
      timeoutSeconds: true,
      prompt: true,
      outputTransport: true,
      outputFields: true,
    },
    label: "参数提取",
    group: "数据处理",
    usesModel: true,
    branch: false,
    singleton: false,
    acceptsControl: true,
    fixedFields: false,
    defaults: () => ({
      fields: [
        {
          key: "question",
          label: "问题",
          type: "string",
          required: true,
        },
      ],
      modelId: "",
      systemPrompt: "只提取输入中有依据的参数，不要编造缺失信息。",
      prompt: [
        {
          input: "question",
        },
      ],
      maxOutputTokens: 2048,
      temperature: 0,
      timeoutSeconds: 120,
      outputFields: [
        {
          key: "result",
          label: "提取结果",
          description: "需要从输入提取的内容",
          type: "string",
          required: true,
        },
      ],
      outputTransport: "prompt",
    }),
    inputs: (data) => data.fields,
    outputs: (data) => data.outputFields ?? [],
  },
  intentClassify: {
    configuration: {
      fields: true,
      title: true,
      modelId: true,
      systemPrompt: true,
      maxOutputTokens: true,
      temperature: true,
      timeoutSeconds: true,
      prompt: true,
      outputTransport: true,
      intents: true,
    },
    label: "意图分类",
    group: "流程控制",
    usesModel: true,
    branch: true,
    singleton: false,
    acceptsControl: true,
    fixedFields: false,
    defaults: () => ({
      fields: [
        {
          key: "question",
          label: "问题",
          type: "string",
          required: true,
        },
      ],
      modelId: "",
      systemPrompt: "按分类说明识别输入的主要意图。",
      prompt: [
        {
          input: "question",
        },
      ],
      maxOutputTokens: 512,
      temperature: 0,
      timeoutSeconds: 120,
      outputTransport: "prompt",
      intents: [
        {
          key: "question",
          label: "咨询",
          description: "询问信息、用法或规则",
        },
        {
          key: "feedback",
          label: "反馈",
          description: "提交意见、问题或投诉",
        },
      ],
    }),
    inputs: (data) => data.fields,
    outputs: () => [{ key: "route", label: "选中分支", type: "string", required: true }],
  },
  transform: {
    configuration: { fields: true, title: true, outputFields: true, assignments: true },
    label: "变量处理",
    group: "数据处理",
    usesModel: false,
    branch: false,
    singleton: false,
    acceptsControl: true,
    fixedFields: false,
    defaults: () => ({
      fields: [
        {
          key: "input",
          type: "string",
          required: true,
        },
      ],
      outputFields: [
        {
          key: "result",
          type: "string",
          required: true,
        },
      ],
      assignments: [
        {
          key: "result",
          expression: {
            op: "input",
            input: "input",
          },
        },
      ],
    }),
    inputs: (data) => data.fields,
    outputs: (data) => data.outputFields ?? [],
  },
  script: {
    configuration: {
      fields: true,
      title: true,
      outputFields: true,
      language: true,
      code: true,
      timeoutSeconds: true,
    },
    label: "脚本",
    group: "数据处理",
    usesModel: false,
    branch: false,
    singleton: false,
    acceptsControl: true,
    fixedFields: false,
    defaults: () => ({
      fields: [{ key: "input", label: "输入", type: "object", required: true }],
      outputFields: [{ key: "result", label: "结果", type: "object", required: true }],
      language: "python",
      code: `import json, sys

value = json.load(sys.stdin)
print(json.dumps({"result": value}, ensure_ascii=False))`,
      timeoutSeconds: 10,
    }),
    inputs: (data) => data.fields,
    outputs: (data) => data.outputFields ?? [],
  },
  loop: {
    configuration: {
      fields: true,
      title: true,
      body: true,
      maxItems: true,
      parallelism: true,
      batchSize: true,
      failurePolicy: true,
      outputFields: true,
      retry: true,
    },
    label: "循环",
    group: "流程控制",
    usesModel: false,
    branch: false,
    singleton: false,
    acceptsControl: true,
    fixedFields: true,
    defaults: () => ({
      fields: [{ key: "items", label: "输入列表", type: "array", required: true }],
      body: defaultLoopBody(false),
      maxItems: 100,
      parallelism: 1,
      failurePolicy: "failFast",
      outputFields: LOOP_OUTPUTS.map((field) => ({
        ...field,
        items: field.items ? { ...field.items } : undefined,
      })),
      retry: { maxAttempts: 1, backoffMs: 1000, maxBackoffMs: 120000, retryOn: [] },
    }),
    inputs: (data) => data.fields,
    outputs: (data) => data.outputFields ?? LOOP_OUTPUTS,
  },
  batch: {
    configuration: {
      fields: true,
      title: true,
      body: true,
      maxItems: true,
      parallelism: true,
      batchSize: true,
      failurePolicy: true,
      outputFields: true,
      retry: true,
    },
    label: "批处理",
    group: "流程控制",
    usesModel: false,
    branch: false,
    singleton: false,
    acceptsControl: true,
    fixedFields: true,
    defaults: () => ({
      fields: [{ key: "items", label: "输入列表", type: "array", required: true }],
      body: defaultLoopBody(true),
      maxItems: 100,
      parallelism: 1,
      batchSize: 10,
      failurePolicy: "continue",
      outputFields: LOOP_OUTPUTS.map((field) => ({
        ...field,
        items: field.items ? { ...field.items } : undefined,
      })),
      retry: { maxAttempts: 1, backoffMs: 1000, maxBackoffMs: 120000, retryOn: [] },
    }),
    inputs: (data) => data.fields,
    outputs: (data) => data.outputFields ?? LOOP_OUTPUTS,
  },
};

export function isWorkflowV2Kind(kind: unknown): kind is WorkflowV2Kind {
  return typeof kind === "string" && Object.hasOwn(NODE_DEFINITIONS, kind);
}
export const NODE_KINDS = Object.keys(NODE_DEFINITIONS).filter(isWorkflowV2Kind);
export const NODE_LABELS = Object.fromEntries(
  NODE_KINDS.map((kind) => [kind, NODE_DEFINITIONS[kind].label]),
) as Record<WorkflowV2Kind, string>;
export function usesModel(kind?: string): kind is ModelNodeKind {
  return isWorkflowV2Kind(kind) && NODE_DEFINITIONS[kind].usesModel;
}
export function isBranch(kind?: string): kind is BranchNodeKind {
  return isWorkflowV2Kind(kind) && NODE_DEFINITIONS[kind].branch;
}
export function defaultData<K extends WorkflowV2Kind>(kind: K): WorkflowV2NodeData<K> {
  return NODE_DEFINITIONS[kind].defaults();
}

/** type 与 data 在此由同一个 kind 构造；断言只弥补泛型索引丢失的关联，不接收外部数据。 */
export function createWorkflowNode<K extends WorkflowV2Kind>(
  kind: K,
  id: string,
  position: { x: number; y: number },
): WorkflowV2Node<K> {
  return { id, type: kind, position, data: defaultData(kind) } as WorkflowV2Node<K>;
}

export function inputFields(node: WorkflowV2Node): WorkflowField[] {
  return fieldsForKind(node.type, node.data, "inputs");
}
export function outputFields(node: WorkflowV2Node): WorkflowField[] {
  return fieldsForKind(node.type, node.data, "outputs");
}
function fieldsForKind<K extends WorkflowV2Kind>(
  kind: K,
  data: WorkflowV2NodeData<K>,
  direction: "inputs" | "outputs",
): WorkflowField[] {
  return NODE_DEFINITIONS[kind][direction](data);
}

/** 仅区分界面语义，不改写已保存的 question 端口标识或连线。 */
export function nodeInputLabel(kind: string | undefined, field: WorkflowField): string {
  if (field.key === "originalQuestion" && kind === "knowledgeRetrieve") return "原始问题（可选）";
  if (field.key === "question" && kind === "knowledgeRetrieve") return "检索词";
  if (field.key === "question" && kind === "knowledgeAnswer") return "原始问题";
  if (field.key === "context" && kind === "knowledgeAnswer") return "检索上下文";
  return field.label || field.key;
}
export function branchPorts(data: WorkflowV2NodeData) {
  return [
    ...(data.intents ?? data.cases ?? []).map((item) => ({
      key: item.key,
      label: item.label || item.key,
    })),
    { key: "else", label: "ELSE · 默认分支" },
  ];
}
