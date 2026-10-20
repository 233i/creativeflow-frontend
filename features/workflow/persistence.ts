import type {
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeKind,
} from "@/features/workflow/types";
import { WORKFLOW_NODE_SIZE } from "@/features/workflow/types";
import { isValidWorkflowConnection } from "@/features/workflow/validation";

export const WORKFLOW_FILE_FORMAT = "creativeflow-workflow";
const LEGACY_WORKFLOW_FILE_FORMAT = "sol-workflow";
export const WORKFLOW_FILE_FORMAT_VERSION = 1;
export const WORKFLOW_SCHEMA_VERSION = 1;
export const MAX_WORKFLOW_FILE_BYTES = 2 * 1024 * 1024;

const MAX_NODES = 40;
const MAX_EDGES = 100;
const NODE_KINDS = new Set<WorkflowNodeKind>([
  "text",
  "image",
  "imageGenerate",
  "videoGenerate",
  "videoExtend",
  "videoFrame",
  "imageOutput",
  "videoOutput",
  "output",
]);

export interface WorkflowFile {
  format: typeof WORKFLOW_FILE_FORMAT;
  formatVersion: typeof WORKFLOW_FILE_FORMAT_VERSION;
  schemaVersion: typeof WORKFLOW_SCHEMA_VERSION;
  name: string;
  exportedAt: string;
  graph: WorkflowGraph;
}

export type WorkflowImportResult =
  { ok: true; name: string; graph: WorkflowGraph } | { ok: false; detail: string };

/** 只序列化可复用定义；服务器标识和运行历史不写入文件。 */
export function exportWorkflow(name: string, graph: WorkflowGraph): string {
  const file: WorkflowFile = {
    format: WORKFLOW_FILE_FORMAT,
    formatVersion: WORKFLOW_FILE_FORMAT_VERSION,
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    name: name.trim() || "Workflow",
    exportedAt: new Date().toISOString(),
    graph: {
      nodes: graph.nodes.map(stripNodeForFile),
      edges: graph.edges.map(stripEdgeForFile),
      ...(graph.externalApi ? { externalApi: structuredClone(graph.externalApi) } : {}),
    },
  };

  return JSON.stringify(file, null, 2);
}

/**
 * 在工作流文件进入 React Flow 或保存 API 前解析它。
 *
 * 允许不完整草稿，但会检查节点结构、标识、类型化端口、重复连接、限制和环路，
 * 防止不受信任的文件让编辑器进入损坏状态。
 */
export function importWorkflow(json: string): WorkflowImportResult {
  if (new TextEncoder().encode(json).byteLength > MAX_WORKFLOW_FILE_BYTES) {
    return { ok: false, detail: "file exceeds 2 MB" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, detail: "invalid JSON" };
  }

  if (!isRecord(parsed)) return { ok: false, detail: "expected an object" };
  if (parsed.format !== WORKFLOW_FILE_FORMAT && parsed.format !== LEGACY_WORKFLOW_FILE_FORMAT) {
    return { ok: false, detail: "not a CreativeFlow workflow file" };
  }
  if (parsed.formatVersion !== WORKFLOW_FILE_FORMAT_VERSION) {
    return { ok: false, detail: `unsupported file format version ${String(parsed.formatVersion)}` };
  }
  if (parsed.schemaVersion !== WORKFLOW_SCHEMA_VERSION) {
    return {
      ok: false,
      detail: `unsupported workflow schema version ${String(parsed.schemaVersion)}`,
    };
  }
  if (typeof parsed.name !== "string" || !parsed.name.trim() || parsed.name.length > 200) {
    return { ok: false, detail: "workflow name is missing or too long" };
  }
  if (!isRecord(parsed.graph)) return { ok: false, detail: "workflow graph is missing" };

  const graph = parseGraph(parsed.graph);
  return graph.ok ? { ok: true, name: parsed.name.trim(), graph: graph.graph } : graph;
}

type GraphResult = { ok: true; graph: WorkflowGraph } | { ok: false; detail: string };

function parseGraph(candidate: Record<string, unknown>): GraphResult {
  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
    return { ok: false, detail: "workflow graph must contain nodes and edges" };
  }
  if (candidate.nodes.length > MAX_NODES) {
    return { ok: false, detail: `workflow may contain at most ${MAX_NODES} nodes` };
  }
  if (candidate.edges.length > MAX_EDGES) {
    return { ok: false, detail: `workflow may contain at most ${MAX_EDGES} edges` };
  }

  const ids = new Set<string>();
  const nodes: WorkflowNode[] = [];
  for (const item of candidate.nodes) {
    if (!isRecord(item)) return { ok: false, detail: "every workflow node must be an object" };

    const id = item.id;
    const type = item.type;
    const position = item.position;
    const data = item.data;
    if (typeof id !== "string" || !id.trim() || id.length > 100) {
      return { ok: false, detail: "a node is missing a valid id" };
    }
    if (ids.has(id)) return { ok: false, detail: `duplicate node id ${id}` };
    if (typeof type !== "string" || !NODE_KINDS.has(type as WorkflowNodeKind)) {
      return { ok: false, detail: `node ${id} has an unsupported type` };
    }
    if (
      !isRecord(position) ||
      typeof position.x !== "number" ||
      !Number.isFinite(position.x) ||
      typeof position.y !== "number" ||
      !Number.isFinite(position.y)
    ) {
      return { ok: false, detail: `node ${id} has no valid position` };
    }
    if (!isRecord(data)) return { ok: false, detail: `node ${id} has no valid data` };

    const kind = type as WorkflowNodeKind;
    const size = WORKFLOW_NODE_SIZE[kind];
    nodes.push({
      id,
      type: kind,
      position: { x: position.x, y: position.y },
      width: positiveNumber(item.width) ?? size.width,
      height: positiveNumber(item.height) ?? size.height,
      data: stripEphemeralAsset(data) as WorkflowNode["data"],
    });
    ids.add(id);
  }

  const edgeIds = new Set<string>();
  const edges: WorkflowEdge[] = [];
  for (const item of candidate.edges) {
    if (!isRecord(item)) return { ok: false, detail: "every workflow edge must be an object" };

    const { id, source, target, sourceHandle, targetHandle } = item;
    if (typeof id !== "string" || !id.trim()) {
      return { ok: false, detail: "an edge is missing its id" };
    }
    if (edgeIds.has(id)) return { ok: false, detail: `duplicate edge id ${id}` };
    if (typeof source !== "string" || typeof target !== "string") {
      return { ok: false, detail: `edge ${id} is missing a source or target` };
    }
    if (typeof sourceHandle !== "string" || typeof targetHandle !== "string") {
      return { ok: false, detail: `edge ${id} is missing a typed port` };
    }

    const edge: WorkflowEdge = {
      id,
      source,
      target,
      sourceHandle,
      targetHandle,
      type: "default",
    };
    if (!isValidWorkflowConnection(edge, nodes, edges)) {
      return { ok: false, detail: `edge ${id} is invalid, duplicated, or creates a cycle` };
    }

    edgeIds.add(id);
    edges.push(edge);
  }

  const externalApi = parseExternalApi(candidate.externalApi, ids);
  if (!externalApi.ok) return externalApi;
  return {
    ok: true,
    graph: {
      nodes,
      edges,
      ...(externalApi.value ? { externalApi: externalApi.value } : {}),
    },
  };
}

function parseExternalApi(
  candidate: unknown,
  nodeIds: ReadonlySet<string>,
): { ok: true; value?: WorkflowGraph["externalApi"] } | { ok: false; detail: string } {
  if (candidate === undefined) return { ok: true };
  if (
    !isRecord(candidate) ||
    candidate.schemaVersion !== 1 ||
    !Array.isArray(candidate.inputs) ||
    !Array.isArray(candidate.outputs)
  ) {
    return { ok: false, detail: "external API settings are invalid" };
  }
  if (candidate.inputs.length > 50 || candidate.outputs.length > 20) {
    return { ok: false, detail: "external API contains too many bindings" };
  }
  const inputs = candidate.inputs.filter(isRecord).map((input) => structuredClone(input));
  const outputs = candidate.outputs.filter(isRecord).map((output) => structuredClone(output));
  if (inputs.length !== candidate.inputs.length || outputs.length !== candidate.outputs.length) {
    return { ok: false, detail: "external API bindings must be objects" };
  }
  if (
    inputs.some(
      (input) =>
        !isRecord(input.target) ||
        typeof input.target.nodeId !== "string" ||
        !nodeIds.has(input.target.nodeId),
    ) ||
    outputs.some((output) => typeof output.nodeId !== "string" || !nodeIds.has(output.nodeId))
  ) {
    return { ok: false, detail: "external API binding targets a missing node" };
  }
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      inputs: inputs as unknown as NonNullable<WorkflowGraph["externalApi"]>["inputs"],
      outputs: outputs as unknown as NonNullable<WorkflowGraph["externalApi"]>["outputs"],
    },
  };
}

function stripNodeForFile(node: WorkflowNode): WorkflowNode {
  return {
    id: node.id,
    type: node.type,
    position: { ...node.position },
    width: node.width,
    height: node.height,
    data: stripEphemeralAsset(node.data) as WorkflowNode["data"],
  };
}

function stripEdgeForFile(edge: WorkflowEdge): WorkflowEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
    type: "default",
  };
}

function stripEphemeralAsset(data: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...data };
  const assetUrl = copy.assetUrl;
  if (
    typeof assetUrl !== "string" ||
    assetUrl.startsWith("blob:") ||
    assetUrl.startsWith("data:")
  ) {
    delete copy.assetUrl;
  }
  return copy;
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
