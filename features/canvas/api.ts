import { createApiClient } from "@/lib/api-client";
import type { CanvasEdge, CanvasNode } from "@/features/canvas/store";

/**
 * 画布文档 API。
 *
 * 浏览器在 localStorage 中保留副本，用于即时加载和离线编辑；此处是持久化副本。
 * 该接口出现前，清除站点数据会销毁用户创建的所有图。
 */

const BASE = "/api/v1/canvas";

export interface CanvasSummary {
  id: string;
  name: string;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasDocument {
  id: string;
  name: string;
  graph: { nodes: CanvasNode[]; edges: CanvasEdge[] } | null;
  createdAt: string;
  updatedAt: string;
}

export class CanvasApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CanvasApiError";
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

const request = createApiClient({
  baseUrl: BASE,
  createError: ({ code, details, status, fallbackMessage }) =>
    new CanvasApiError(details[0] ?? code ?? fallbackMessage, status),
});

export function listCanvases(): Promise<{ canvases: CanvasSummary[] }> {
  return request("");
}

/**
 * 将完整文档缩减为列表条目。
 *
 * 使刚创建或重命名画布的调用方可将结果直接插入现有列表，
 * 而无需重新获取已经拿到的信息。
 */
export function summarize(document: CanvasDocument): CanvasSummary {
  return {
    id: document.id,
    name: document.name,
    nodeCount: document.graph?.nodes?.length ?? 0,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function getCanvas(id: string): Promise<CanvasDocument> {
  return request(`/${id}`);
}

export function createCanvas(
  name?: string,
  graph?: { nodes: CanvasNode[]; edges: CanvasEdge[] },
): Promise<CanvasDocument> {
  return request("", { method: "POST", body: JSON.stringify({ name, graph }) });
}

/**
 * 写入画布；指定标识尚不存在时创建。
 *
 * PUT 时创建的行为使只存在于 localStorage 的画布可由服务器按原标识接管，而不会产生重复副本。
 */
export function saveCanvas(
  id: string,
  graph: { nodes: CanvasNode[]; edges: CanvasEdge[] },
  name?: string,
): Promise<CanvasDocument> {
  return request(`/${id}`, { method: "PUT", body: JSON.stringify({ name, graph }) });
}

/** 只重命名而不修改图；省略 `graph` 时服务器会保持图不变。 */
export function renameCanvas(id: string, name: string): Promise<CanvasDocument> {
  return request(`/${id}`, { method: "PUT", body: JSON.stringify({ name }) });
}

export function deleteCanvas(id: string): Promise<void> {
  return request(`/${id}`, { method: "DELETE" });
}

// --- 素材库 ---

export interface CanvasAssetSummary {
  id: string;
  url: string;
  kind: "image" | "video";
  mediaType: string;
  byteSize: number;
  /** 如果素材由生成而非上传得到，则为生成它所用的提示词。 */
  prompt: string | null;
  createdAt: string;
  /** 素材所属文件夹；位于未分组集合时为空。 */
  groupId: string | null;
}

export interface CanvasAssetGroupSummary {
  id: string;
  name: string;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 列出已存储媒体，最新的排在前面。
 *
 * 服务器端限制数量；此接口服务于选择器，而不是归档浏览器。
 */
export function listAssets(kind?: "image" | "video"): Promise<{ assets: CanvasAssetSummary[] }> {
  return request(`/assets${kind ? `?kind=${kind}` : ""}`);
}

/** 列出素材库中用户创建的文件夹。 */
export function listAssetGroups(): Promise<{ groups: CanvasAssetGroupSummary[] }> {
  return request("/assets/groups");
}

/** 创建文件夹，但不分配任何素材。 */
export function createAssetGroup(name: string): Promise<CanvasAssetGroupSummary> {
  return request("/assets/groups", { method: "POST", body: JSON.stringify({ name }) });
}

/** 重命名文件夹，同时保留素材归属。 */
export function renameAssetGroup(id: string, name: string): Promise<CanvasAssetGroupSummary> {
  return request(`/assets/groups/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

/** 删除文件夹；服务器会将其中素材保留为未分组状态。 */
export function deleteAssetGroup(id: string): Promise<void> {
  return request(`/assets/groups/${id}`, { method: "DELETE" });
}

/** 将所选内容移入文件夹。传空值可移除当前归属。 */
export function assignAssetsToGroup(
  assetIds: string[],
  groupId: string | null,
): Promise<{ updated: number }> {
  return request("/assets/group", {
    method: "PATCH",
    body: JSON.stringify({ assetIds, groupId }),
  });
}

/**
 * 删除素材及其背后的文件。
 *
 * 仍引用该素材的画布会显示损坏图片。这是可接受的权衡：
 * 若拒绝删除任何可能正在使用的内容，素材库将无法管理。
 */
export function deleteAsset(id: string): Promise<void> {
  return request(`/assets/${id}`, { method: "DELETE" });
}
