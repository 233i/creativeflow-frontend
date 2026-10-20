import { createApiClient } from "@/lib/api-client";
import type {
  WorkflowGraph,
  WorkflowPartialRerunPreview,
  WorkflowRun,
} from "@/features/workflow/types";

const BASE = "/api/v1/workflows";

export interface WorkflowSummary {
  id: string;
  name: string;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDocument {
  id: string;
  name: string;
  schemaVersion: number;
  graph: WorkflowGraph | null;
  createdAt: string;
  updatedAt: string;
  copyOrigin?: { source: "workflow" | "template"; id: string } | null;
}

/** 历史列表仅含安全元数据，节点输入输出需在选中后重新鉴权读取。 */
export type WorkflowRunHistoryItem = Pick<
  WorkflowRun,
  | "id"
  | "status"
  | "resumedFromRunId"
  | "createdAt"
  | "updatedAt"
  | "startedAt"
  | "finishedAt"
  | "debugNodeId"
>;

export class WorkflowApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = "WorkflowApiError";
  }
}

/** 普通工作流与后台 API 共用文档和调试协议，仅入口地址不同。 */
export function createWorkflowApiClient(baseUrl = BASE) {
  const request = createApiClient({
    baseUrl,
    networkErrorMessage: "Failed to reach the workflow API",
    createError: ({ code, details, status, fallbackMessage }) =>
      new WorkflowApiError(details[0] ?? code ?? fallbackMessage, status, details),
  });

  function listWorkflows(): Promise<{ workflows: WorkflowSummary[] }> {
    return request("");
  }

  function getWorkflow(id: string): Promise<WorkflowDocument> {
    return request(`/${id}`);
  }

  function createWorkflow(
    name: string,
    graph: WorkflowGraph,
    copyOrigin?: WorkflowDocument["copyOrigin"],
  ): Promise<WorkflowDocument> {
    return request("", {
      method: "POST",
      body: JSON.stringify({
        name,
        schemaVersion: graph.schemaVersion ?? 1,
        graph,
        ...(copyOrigin ? { copyOrigin } : {}),
      }),
    });
  }

  function saveWorkflow(
    id: string,
    graph: WorkflowGraph,
    name?: string,
  ): Promise<WorkflowDocument> {
    return request(`/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, schemaVersion: graph.schemaVersion ?? 1, graph }),
    });
  }

  function renameWorkflow(id: string, name: string): Promise<WorkflowDocument> {
    return request(`/${id}`, { method: "PUT", body: JSON.stringify({ name }) });
  }

  function deleteWorkflow(id: string): Promise<void> {
    return request(`/${id}`, { method: "DELETE" });
  }

  function startWorkflowRun(id: string, inputs?: Record<string, unknown>): Promise<WorkflowRun> {
    return request(`/${id}/runs`, {
      method: "POST",
      ...(inputs ? { body: JSON.stringify({ inputs }) } : {}),
    });
  }

  function getWorkflowCapabilities(): Promise<{ enabled: boolean; nodeTypes: string[] }> {
    return request("/capabilities");
  }

  function startNodeDebug(
    id: string,
    nodeId: string,
    input: { requestId: string; inputs: Record<string, unknown>; sourceRunId?: string },
  ): Promise<WorkflowRun> {
    return request(`/${id}/nodes/${encodeURIComponent(nodeId)}/debug-runs`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  function getNodeDebugInputs(
    id: string,
    nodeId: string,
    sourceRunId: string,
  ): Promise<{ inputs: Record<string, unknown>; readonlyFields: string[] }> {
    return request(
      `/${id}/nodes/${encodeURIComponent(nodeId)}/debug-inputs?sourceRunId=${encodeURIComponent(sourceRunId)}`,
    );
  }

  function resumeWorkflowRun(id: string, runId: string): Promise<WorkflowRun> {
    return request(`/${id}/runs/${runId}/resume`, { method: "POST" });
  }

  function previewPartialWorkflowRerun(
    id: string,
    runId: string,
    fromNodeId: string,
  ): Promise<WorkflowPartialRerunPreview> {
    const query = new URLSearchParams({ fromNodeId });
    return request(`/${id}/runs/${runId}/partial-rerun/preview?${query}`);
  }

  function partialRerunWorkflow(
    id: string,
    runId: string,
    fromNodeId: string,
  ): Promise<WorkflowRun> {
    return request(`/${id}/runs/${runId}/partial-rerun`, {
      method: "POST",
      body: JSON.stringify({ fromNodeId }),
    });
  }

  function retryWorkflowNode(id: string, runId: string, nodeId: string): Promise<WorkflowRun> {
    return request(`/${id}/runs/${runId}/nodes/${encodeURIComponent(nodeId)}/retry`, {
      method: "POST",
    });
  }

  function skipWorkflowNode(
    id: string,
    runId: string,
    nodeId: string,
    reason?: string,
  ): Promise<WorkflowRun> {
    return request(`/${id}/runs/${runId}/nodes/${encodeURIComponent(nodeId)}/skip`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  function rollbackWorkflowRun(
    id: string,
    runId: string,
    fromNodeId: string,
  ): Promise<WorkflowRun> {
    return request(`/${id}/runs/${runId}/rollback`, {
      method: "POST",
      body: JSON.stringify({ fromNodeId }),
    });
  }

  async function getLatestWorkflowRun(id: string): Promise<WorkflowRun | null> {
    try {
      return await request(`/${id}/runs/latest`);
    } catch (error) {
      if (error instanceof WorkflowApiError && error.status === 404) return null;
      throw error;
    }
  }

  function getWorkflowRun(id: string, runId: string): Promise<WorkflowRun> {
    return request(`/${id}/runs/${runId}`);
  }

  function getWorkflowRunSnapshot(
    id: string,
    runId: string,
  ): Promise<{ runId: string; graph: WorkflowGraph }> {
    return request(`/${id}/runs/${runId}/snapshot`, { cache: "no-store" });
  }

  function listWorkflowRuns(id: string): Promise<{ runs: WorkflowRunHistoryItem[] }> {
    return request(`/${id}/runs`, { cache: "no-store" });
  }

  function cancelWorkflowRun(id: string, runId: string): Promise<void> {
    return request(`/${id}/runs/${runId}`, { method: "DELETE" });
  }

  return {
    startNodeDebug,
    getNodeDebugInputs,
    getWorkflowRunSnapshot,
    getWorkflowCapabilities,
    listWorkflows,
    getWorkflow,
    createWorkflow,
    saveWorkflow,
    renameWorkflow,
    deleteWorkflow,
    startWorkflowRun,
    resumeWorkflowRun,
    previewPartialWorkflowRerun,
    partialRerunWorkflow,
    retryWorkflowNode,
    skipWorkflowNode,
    rollbackWorkflowRun,
    getLatestWorkflowRun,
    getWorkflowRun,
    listWorkflowRuns,
    cancelWorkflowRun,
  };
}

export const {
  startNodeDebug,
  getNodeDebugInputs,
  getWorkflowRunSnapshot,
  getWorkflowCapabilities,
  listWorkflows,
  getWorkflow,
  createWorkflow,
  saveWorkflow,
  renameWorkflow,
  deleteWorkflow,
  startWorkflowRun,
  resumeWorkflowRun,
  previewPartialWorkflowRerun,
  partialRerunWorkflow,
  retryWorkflowNode,
  skipWorkflowNode,
  rollbackWorkflowRun,
  getLatestWorkflowRun,
  getWorkflowRun,
  listWorkflowRuns,
  cancelWorkflowRun,
} = createWorkflowApiClient();

export function summarize(document: WorkflowDocument): WorkflowSummary {
  return {
    id: document.id,
    name: document.name,
    nodeCount: document.graph?.nodes.length ?? 0,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export type WorkflowClient = ReturnType<typeof createWorkflowApiClient>;
