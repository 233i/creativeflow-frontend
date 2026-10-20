import { createApiClient } from "@/lib/api-client";
import type {
  WorkflowTemplateDocument,
  WorkflowTemplateInput,
  WorkflowTemplateStatus,
  WorkflowTemplateSummary,
} from "@/features/workflow/templates-api";
import type { WorkflowDocument } from "@/features/workflow/api";
import type { WorkflowGraph } from "@/features/workflow/types";

const BASE = "/api/v1/admin";

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

const request = createApiClient({
  baseUrl: BASE,
  createError: ({ code, details, status, fallbackMessage }) =>
    new AdminApiError(code ?? fallbackMessage, status, details),
});

export interface AdminIdentity {
  id: string;
  username: string;
  mustChangePassword: boolean;
}

export interface AdminMe {
  isAuthenticated: boolean;
  admin: AdminIdentity | null;
}

export function getMe(): Promise<AdminMe> {
  return request("/auth/me");
}

export function login(username: string, password: string): Promise<AdminMe> {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logout(): Promise<void> {
  return request("/auth/logout", { method: "POST" });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return request("/auth/password", {
    method: "PATCH",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export interface ManagedUser {
  id: string;
  displayName: string;
  email: string | null;
  isEnabled: boolean;
  createdAt: string;
}

export interface ManagedUserList {
  users: ManagedUser[];
  total: number;
  offset: number;
  limit: number;
}

export function listUsers(search = "", offset = 0, limit = 100): Promise<ManagedUserList> {
  const query = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  if (search.trim()) query.set("search", search.trim());
  return request(`/users?${query.toString()}`);
}

export function setUserEnabled(id: string, isEnabled: boolean): Promise<void> {
  return request(`/users/${encodeURIComponent(id)}/enabled`, {
    method: "PATCH",
    body: JSON.stringify({ isEnabled }),
  });
}

export function listWorkflowTemplates(
  search = "",
  status: WorkflowTemplateStatus | "" = "",
  category = "",
): Promise<{ templates: WorkflowTemplateSummary[] }> {
  const query = new URLSearchParams();
  if (search.trim()) query.set("search", search.trim());
  if (status) query.set("status", status);
  if (category.trim()) query.set("category", category.trim());
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return request(`/workflow-templates${suffix}`);
}

export function getWorkflowTemplate(id: string): Promise<WorkflowTemplateDocument> {
  return request(`/workflow-templates/${encodeURIComponent(id)}`);
}

export function createWorkflowTemplate(
  input: WorkflowTemplateInput,
): Promise<WorkflowTemplateDocument> {
  return request("/workflow-templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateWorkflowTemplate(
  id: string,
  input: Partial<WorkflowTemplateInput>,
): Promise<WorkflowTemplateDocument> {
  return request(`/workflow-templates/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function saveWorkflowTemplateGraph(
  id: string,
  graph: WorkflowGraph,
): Promise<WorkflowTemplateDocument> {
  return updateWorkflowTemplate(id, { schemaVersion: 1, graph });
}

export function prepareWorkflowTemplateDebug(id: string): Promise<WorkflowDocument> {
  return request(`/workflow-templates/${encodeURIComponent(id)}/debug-workflow`, {
    method: "POST",
  });
}

export function publishWorkflowTemplate(id: string): Promise<WorkflowTemplateDocument> {
  return request(`/workflow-templates/${encodeURIComponent(id)}/publish`, { method: "POST" });
}

export function archiveWorkflowTemplate(id: string): Promise<WorkflowTemplateDocument> {
  return request(`/workflow-templates/${encodeURIComponent(id)}/archive`, { method: "POST" });
}

export function duplicateWorkflowTemplate(id: string): Promise<WorkflowTemplateDocument> {
  return request(`/workflow-templates/${encodeURIComponent(id)}/duplicate`, { method: "POST" });
}

export function deleteWorkflowTemplate(id: string): Promise<void> {
  return request(`/workflow-templates/${encodeURIComponent(id)}`, { method: "DELETE" });
}
