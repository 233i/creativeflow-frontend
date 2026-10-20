import { createApiClient } from "@/lib/api-client";
import { createWorkflowApiClient, WorkflowApiError } from "@/features/workflow/api";
import type { UploadedAsset } from "@/features/ai/api";
import type { CanvasAssetSummary, CanvasAssetGroupSummary } from "@/features/canvas/api";
import type { WorkflowGraph } from "@/features/workflow/types";
import type { WorkflowEditorAssets } from "@/features/workflow/editor-assets";
import {
  assetQueryString,
  type AssetQuery,
  type AssetPage,
  type AssetItem,
} from "@/features/assets/api";

const BASE = "/api/v1/admin/workflow-apis";
export const editorApi = createWorkflowApiClient(BASE);

export interface ManagedWorkflowApi {
  id: string;
  name: string;
  status: "draft" | "published" | "disabled";
  version: number | null;
  updatedAt: string;
}

const request = createApiClient({
  baseUrl: BASE,
  networkErrorMessage: "无法连接 API 管理服务",
  createError: ({ details, code, status, fallbackMessage }) =>
    new WorkflowApiError(details[0] ?? code ?? fallbackMessage, status, details),
});

export function listWorkflowApis(): Promise<{ apis: ManagedWorkflowApi[] }> {
  return request("");
}

/** 模板参考图属于原调试空间；新 API 保留结构，由管理员重新选择参考图。 */
export function copyTemplateGraphForApi(graph: WorkflowGraph): WorkflowGraph {
  const copy = structuredClone(graph);
  for (const node of copy.nodes) {
    if (node.type === "image") {
      delete node.data.assetUrl;
      delete node.data.mediaType;
    }
  }
  for (const input of copy.externalApi?.inputs ?? []) {
    if (input.type === "image") delete input.default;
  }
  return copy;
}

/** 保留图中固定素材 URL，仅在后台展示时使用管理员认证的媒体入口。 */
export function workflowApiAssetUrl(workflowId: string, url: string): string {
  const match = /^\/api\/v1\/canvas\/assets\/([0-9a-f-]{36})(\/thumbnail)?(?:[?#].*)?$/i.exec(url);
  if (match) return `${BASE}/${encodeURIComponent(workflowId)}/assets/${match[1]}${match[2] ?? ""}`;
  const shared =
    /^\/api\/v1\/canvas\/asset-library\/public\/([0-9a-f-]{36})\/(thumbnail|content)$/i.exec(url);
  return shared
    ? `${BASE}/${encodeURIComponent(workflowId)}/assets/public/${shared[1]}/${shared[2]}`
    : url;
}

export function createWorkflowApiAssets(workflowId: string): WorkflowEditorAssets {
  const path = `/${encodeURIComponent(workflowId)}/assets`;
  return {
    listAssets: (): Promise<{ assets: CanvasAssetSummary[] }> => request(path + "?kind=image"),
    listAssetPage: (query: AssetQuery): Promise<AssetPage> =>
      request(path + "/library?" + assetQueryString(query)),
    reusePublicAsset: (id: string, revision: string): Promise<AssetItem> =>
      request(path + `/public/${encodeURIComponent(id)}/reuse`, {
        method: "POST",
        body: JSON.stringify({ revision }),
      }),
    listAssetGroups: (): Promise<{ groups: CanvasAssetGroupSummary[] }> =>
      request(path + "/groups"),
    uploadAsset: (file: File): Promise<UploadedAsset> => {
      const form = new FormData();
      form.append("file", file);
      return request(path, { method: "POST", body: form });
    },
    assetUrl: (url: string) => workflowApiAssetUrl(workflowId, url),
  };
}
