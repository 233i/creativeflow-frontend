import { createApiClient } from "@/lib/api-client";
import { AdminApiError } from "@/features/admin/api";

/** 管理记录支持的两个独立来源。 */
export type RequestSource = "canvas" | "workflow";

/** 请求记录列表的一行，不包含体积较大的输入和产物正文。 */
export interface RequestSummary {
  /** 请求或运行标识。 */
  id: string;
  /** 画布或工作流。 */
  source: RequestSource;
  /** 文本、图片、视频或工作流运行。 */
  kind: string;
  /** 持久化执行状态。 */
  status: string;
  /** 请求发生时的用户。 */
  accountId: string | null;
  /** 用户昵称。 */
  userName: string | null;
  /** 用户邮箱。 */
  email: string | null;
  /** 所属画布或工作流标识。 */
  projectId: string | null;
  /** 所属画布或工作流名称。 */
  projectName: string;
  /** 发起画布生成的节点。 */
  nodeId: string | null;
  /** 生成模型。 */
  modelKey: string | null;
  /** 渠道名称。 */
  providerName: string | null;
  /** 请求开始时间。 */
  createdAt: string;
  /** 请求结束时间。 */
  finishedAt: string | null;
  /** 失败原因。 */
  error: string | null;
  /** 是否来自已有视频任务，可能没有画布关联。 */
  historical: boolean;
}

/** 一个文本或媒体产物。 */
export interface RequestArtifact {
  /** 产物类型。 */
  kind: string;
  /** 文本生成内容。 */
  text: string | null;
  /** 持久化素材标识。 */
  assetId: string | null;
  /** 绑定该记录并需要管理员会话的地址。 */
  url: string | null;
  /** 已验证媒体类型。 */
  mediaType: string | null;
  /** 素材已删除或不再可访问。 */
  unavailable: boolean;
}

/** 工作流一次运行中的节点明细。 */
export interface RequestNode {
  /** 节点标识。 */
  id: string;
  /** 节点类型。 */
  type: string;
  /** 执行状态。 */
  status: string;
  /** 是否复用此前产物。 */
  reused: boolean;
  /** 运行时保存的节点参数。 */
  input: Record<string, unknown>;
  /** 节点产物。 */
  artifacts: RequestArtifact[];
  /** 节点失败原因。 */
  error: string | null;
  /** 节点开始时间。 */
  startedAt: string | null;
  /** 节点结束时间。 */
  finishedAt: string | null;
}

/** 一条请求的完整详情。 */
export interface RequestDetail {
  /** 列表基本资料。 */
  summary: RequestSummary;
  /** 生成参数。 */
  input: Record<string, unknown>;
  /** 最终产物。 */
  artifacts: RequestArtifact[];
  /** 工作流节点；画布为空。 */
  nodes: RequestNode[];
}

/** 后端分页结果。 */
export interface RequestPage {
  /** 当前页记录。 */
  items: RequestSummary[];
  /** 满足条件的总数。 */
  total: number;
  /** 当前页偏移。 */
  offset: number;
  /** 每页条数。 */
  limit: number;
}

/** 管理列表筛选。 */
export interface RequestFilters {
  /** 必选的画布或工作流来源。 */
  source: RequestSource;
  /** 精确用户筛选。 */
  accountId?: string;
  /** 用户昵称、邮箱或标识。 */
  search?: string;
  /** 执行状态。 */
  status?: string;
  /** 分页偏移。 */
  offset?: number;
  /** 管理运行中心使用 20 或 50；省略时兼容旧调用的 30 条。 */
  limit?: number;
}

const request = createApiClient({
  baseUrl: "/api/v1/admin/requests",
  createError: ({ code, details, status, fallbackMessage }) =>
    new AdminApiError(details[0] ?? code ?? fallbackMessage, status, details),
});

/** 读取请求分页；参数通过 URLSearchParams 编码，保留管理员会话。 */
export function listRequests(filters: RequestFilters): Promise<RequestPage> {
  const query = new URLSearchParams({
    source: filters.source,
    offset: String(filters.offset ?? 0),
    limit: String(filters.limit ?? 30),
  });
  if (filters.accountId) query.set("accountId", filters.accountId);
  if (filters.search?.trim()) query.set("search", filters.search.trim());
  if (filters.status) query.set("status", filters.status);
  return request(`?${query}`);
}

/** 按来源读取详情，避免相同标识被当成另一类记录。 */
export function getRequest(source: RequestSource, id: string): Promise<RequestDetail> {
  return request(`/${source}/${encodeURIComponent(id)}`);
}
