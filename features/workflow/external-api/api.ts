import { createApiClient } from "@/lib/api-client";
import type { PublicationField } from "./contracts";
import type { WorkflowRun } from "../types";
import type { WorkflowGraph } from "../types";

const BASE = "/api/v1/admin/workflow-apis";

export interface WorkflowDeployment {
  id: string;
  workflowId: string;
  version: number;
  schemaVersion: number;
  description: string;
  status: "published" | "disabled";
  maxConcurrency: number;
  inputs: PublicationField[] | null;
  outputs: PublicationField[] | null;
  publishedAt: string;
  disabledAt: string | null;
}

export interface WorkflowApiKey {
  id: string;
  name: string;
  prefix: string;
  hint: string;
  enabled: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  key: string | null;
}

export interface WorkflowExternalRunSummary {
  runId: string;
  requestId: string;
  apiKeyName: string;
  version: number;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

class PublicationApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: string[] = [],
  ) {
    super(message);
  }
}

const requestWorkflow = createApiClient({
  baseUrl: BASE,
  networkErrorMessage: "无法连接工作流 API",
  statusErrorMessage: (status) => `请求失败（${status}）`,
  createError: ({ code, details, status, fallbackMessage }) =>
    new PublicationApiError(details[0] ?? code ?? fallbackMessage, status, details),
});

function request<T>(workflowId: string, path: string, init?: RequestInit): Promise<T> {
  return requestWorkflow(`/${workflowId}${path}`, init);
}

export function listDeployments(
  workflowId: string,
): Promise<{ deployments: WorkflowDeployment[] }> {
  return request(workflowId, "/deployments");
}

/** 后台结果依然需要当前资源许可，不通过 Key 明文代理请求。 */
export function getExternalRun(workflowId: string, runId: string): Promise<WorkflowRun> {
  return request(workflowId, `/external-runs/${encodeURIComponent(runId)}`, { cache: "no-store" });
}

export function getExternalRunSnapshot(
  workflowId: string,
  runId: string,
): Promise<{ runId: string; graph: WorkflowGraph }> {
  return request(workflowId, `/external-runs/${encodeURIComponent(runId)}/snapshot`, {
    cache: "no-store",
  });
}

export function publishWorkflow(
  workflowId: string,
  description: string,
  maxConcurrency: number,
): Promise<WorkflowDeployment> {
  return request(workflowId, "/publish", {
    method: "POST",
    body: JSON.stringify({ description, maxConcurrency }),
  });
}

export function disableWorkflow(workflowId: string): Promise<void> {
  return request(workflowId, "/deployment", { method: "DELETE" });
}

export function listApiKeys(workflowId: string): Promise<{ apiKeys: WorkflowApiKey[] }> {
  return request(workflowId, "/api-keys");
}

export function createApiKey(
  workflowId: string,
  name: string,
  expiresAt?: string,
): Promise<WorkflowApiKey> {
  return request(workflowId, "/api-keys", {
    method: "POST",
    body: JSON.stringify({ name, expiresAt: expiresAt || null }),
  });
}

export function revokeApiKey(workflowId: string, keyId: string): Promise<void> {
  return request(workflowId, `/api-keys/${keyId}`, { method: "DELETE" });
}

export function listExternalRuns(
  workflowId: string,
): Promise<{ runs: WorkflowExternalRunSummary[] }> {
  return request(workflowId, "/external-runs");
}
