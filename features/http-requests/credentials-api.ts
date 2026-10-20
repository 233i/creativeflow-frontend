import { createApiClient } from "@/lib/api-client";
export interface CredentialGrant {
  kind: "account" | "apiKey";
  id: string;
  enabled: boolean;
  name: string;
}
export interface CredentialGrants {
  grants: CredentialGrant[];
  audit: { kind: string; id: string; enabled: boolean; reason: string; createdAt: string }[];
}
export interface CredentialRequestScope {
  method: string;
  url: string;
}

export interface HttpCredentialSummary {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  currentRevision: string | null;
}
export interface HttpCredentialRevision {
  id: string;
  createdAt: string;
  definition: {
    origin: string;
    headers: string[];
    requests: CredentialRequestScope[];
    requestDigest?: string;
  };
  hasSecret: boolean;
}
export interface HttpCredentialDetail extends HttpCredentialSummary {
  revisions: HttpCredentialRevision[];
}
export interface HttpCredentialForm {
  name: string;
  description: string;
  origin: string;
  headers: { name: string; value: string }[];
  requests: CredentialRequestScope[];
}
const request = createApiClient({
  baseUrl: "/api/v1",
  createError: ({ details, fallbackMessage }) => new Error(details.join("；") || fallbackMessage),
});
const base = "/admin/http-credentials";
const path = (id: string) => `${base}/${encodeURIComponent(id)}`;
/** 密钥只在保存时上传，任何 GET 都只返回凭据元数据。 */
export const credentialApi = {
  list: () => request<HttpCredentialSummary[]>(base, { cache: "no-store" }),
  detail: (id: string) => request<HttpCredentialDetail>(path(id), { cache: "no-store" }),
  catalog: (admin: boolean) =>
    request<HttpCredentialDetail[]>(`${admin ? "/admin" : ""}/http-credentials/catalog`, {
      cache: "no-store",
    }),
  save: (id: string | null, value: HttpCredentialForm) =>
    request<{ id: string; revisionId: string }>(id ? path(id) : base, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(value),
    }),
  state: (id: string, enabled: boolean) =>
    request<void>(`${path(id)}/state`, { method: "PUT", body: JSON.stringify({ enabled }) }),
  grants: (id: string) => request<CredentialGrants>(`${path(id)}/grants`, { cache: "no-store" }),
  grant: (
    id: string,
    kind: "account" | "apiKey",
    subject: string,
    enabled: boolean,
    reason: string,
  ) =>
    request<void>(`${path(id)}/grants/${kind}/${encodeURIComponent(subject)}`, {
      method: "PUT",
      body: JSON.stringify({ enabled, reason }),
    }),
};
