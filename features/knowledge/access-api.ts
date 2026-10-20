import { createApiClient } from "@/lib/api-client";

export interface KnowledgeChoice {
  id: string;
  name: string;
  description: string;
  activeVersion: string | null;
  versions: { id: string; createdAt: string; indexSchema?: "dense-v1" | "hybrid-v1" }[];
}
export interface KnowledgeGrant {
  accountId: string;
  displayName: string;
  email: string | null;
  accountEnabled: boolean;
  enabled: boolean;
}
export interface KnowledgeApiKeyGrant {
  apiKeyId: string;
  name: string;
  workflowId: string;
  workflowName: string;
  keyEnabled: boolean;
  enabled: boolean;
}
export interface KnowledgeGrants {
  grants: KnowledgeGrant[];
  audit: {
    accountId: string;
    adminId: string;
    enabled: boolean;
    reason: string;
    createdAt: string;
  }[];
  apiKeys?: KnowledgeApiKeyGrant[];
  apiKeyAudit?: {
    apiKeyId: string;
    adminId: string;
    enabled: boolean;
    reason: string;
    createdAt: string;
  }[];
}
const request = createApiClient({
  baseUrl: "/api/v1",
  createError: ({ details, fallbackMessage }) => new Error(details.join("；") || fallbackMessage),
});

/** 目录不包含向量、模型凭据或正文，打开选择器不触发模型调用。 */
export const knowledgeAccessApi = {
  catalog: (admin: boolean) =>
    request<KnowledgeChoice[]>(`${admin ? "/admin" : ""}/knowledge-bases/catalog`, {
      cache: "no-store",
    }),
  grants: (id: string) =>
    request<KnowledgeGrants>(`/admin/knowledge-bases/${encodeURIComponent(id)}/grants`, {
      cache: "no-store",
    }),
  setGrant: (id: string, account: string, enabled: boolean, reason: string) =>
    request<void>(
      `/admin/knowledge-bases/${encodeURIComponent(id)}/grants/${encodeURIComponent(account)}`,
      { method: "PUT", body: JSON.stringify({ enabled, reason }) },
    ),
  setApiKeyGrant: (id: string, keyId: string, enabled: boolean, reason: string) =>
    request<void>(
      `/admin/knowledge-bases/${encodeURIComponent(id)}/api-key-grants/${encodeURIComponent(keyId)}`,
      { method: "PUT", body: JSON.stringify({ enabled, reason }) },
    ),
};
