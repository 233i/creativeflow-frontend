import { createApiClient } from "@/lib/api-client";
import { WorkflowApiError } from "@/features/workflow/api";
import type { WorkflowGraph, WorkflowRun } from "@/features/workflow/types";

export interface CenterRun {
  id: string;
  workflowId: string;
  triggerType: "interactive" | "api";
  status: string;
  createdAt: string;
  debugNodeId?: string;
}
export interface CenterItem {
  id: string;
  source: "workflow" | "template";
  name: string;
  description: string;
  schemaVersion: number;
  /** 服务端根据图中节点计算的业务类别；schemaVersion 仅表示存储格式。 */
  kind: "media" | "general";
  apiStatus: "none" | "unpublished" | "published" | "disabled";
  apiVersion: number | null;
  templateStatus: "none" | "draft" | "published" | "archived";
  templateVersion: number | null;
  draftStatus: "saved" | "changed" | "unpublished";
  nodeCount: number;
  updatedAt: string;
  latestRun: CenterRun | null;
  deletedAt?: string | null;
}
export interface CenterPage {
  items: CenterItem[];
  total: number;
  offset: number;
  limit: number;
}
export interface CenterRunPage {
  items: CenterRun[];
  total: number;
  offset: number;
  limit: number;
}
export interface CenterQuery {
  search?: string;
  id?: string;
  kind?: string;
  source?: string;
  view?: string;
  apiStatus?: string;
  templateStatus?: string;
  updatedFrom?: string;
  updatedTo?: string;
  includeDeleted?: boolean;
  sort: string;
  offset: number;
  limit: number;
}

export interface WorkflowDeletionPreview {
  id: string;
  source: "workflow" | "template";
  name: string;
  revision: string;
  deletedAt: string | null;
  canDelete: boolean;
  publishedApis: number;
  publishedTemplates: number;
  queuedRuns: number;
  runningRuns: number;
  historyRuns: number;
  deploymentVersions: number;
  apiKeys: number;
  independentCopies: number;
}
export type DeletionTarget = Pick<CenterItem, "id" | "source" | "name">;

/** 删除预览只读；提交前服务端持锁重新检查发布状态及在途任务。 */
export function previewWorkflowDeletion(
  target: Pick<DeletionTarget, "id" | "source">,
  signal?: AbortSignal,
): Promise<WorkflowDeletionPreview> {
  return request(`/${target.source}/${encodeURIComponent(target.id)}/deletion-preview`, {
    signal,
    cache: "no-store",
  });
}
export function deleteManagedWorkflow(
  target: DeletionTarget,
  name: string,
  revision: string,
): Promise<void> {
  return request(`/${target.source}/${encodeURIComponent(target.id)}`, {
    method: "DELETE",
    body: JSON.stringify({ name, revision }),
  });
}

const request = createApiClient({
  baseUrl: "/api/v1/admin/workflow-center",
  networkErrorMessage: "无法连接工作流中心，请重新查询。",
  createError: ({ status, details, fallbackMessage }) =>
    new WorkflowApiError(
      details[0] ?? (status === 401 ? "管理员会话已失效，请重新登录。" : fallbackMessage),
      status,
      details,
    ),
});

export function listWorkflowCenter(query: CenterQuery, signal?: AbortSignal): Promise<CenterPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== "") params.set(key, String(value));
  return request(`?${params}`, { signal, cache: "no-store" });
}

export function listCenterRuns(
  source: "workflow" | "template",
  id: string,
  status: string,
  offset: number,
  limit: number,
  signal?: AbortSignal,
): Promise<CenterRunPage> {
  const params = new URLSearchParams({ status, offset: String(offset), limit: String(limit) });
  return request(`/${source}/${encodeURIComponent(id)}/runs?${params}`, {
    signal,
    cache: "no-store",
  });
}

/** 历史模板没有可写调试会话时也可只读查看；服务器核验来源关系与原资源授权。 */
export function getCenterRun(
  source: "workflow" | "template",
  id: string,
  runId: string,
): Promise<WorkflowRun> {
  return request(`/${source}/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}/detail`, {
    cache: "no-store",
  });
}
export function getCenterRunSnapshot(
  source: "workflow" | "template",
  id: string,
  runId: string,
): Promise<{ runId: string; graph: WorkflowGraph }> {
  return request(
    `/${source}/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}/snapshot`,
    { cache: "no-store" },
  );
}

/** URL 中只解析筛选值；不接受原始排序 SQL、请求正文或运行参数。 */
export function readCenterQuery(params: URLSearchParams, defaultView = ""): CenterQuery {
  const page = Math.max(
    1,
    Math.min(1_000_000, Number.parseInt(params.get("page") ?? "1", 10) || 1),
  );
  const limit = params.get("size") === "50" ? 50 : 20;
  return {
    search: params.get("q") ?? "",
    id: params.get("id") ?? "",
    kind: params.get("kind") ?? "",
    source: params.get("source") ?? "",
    view: params.has("view") ? params.get("view")! : defaultView,
    apiStatus: params.get("api") ?? "",
    templateStatus: params.get("template") ?? "",
    updatedFrom: params.get("from") || undefined,
    updatedTo: params.get("to") || undefined,
    sort: params.get("sort") || "updated_desc",
    offset: (page - 1) * limit,
    limit,
  };
}
