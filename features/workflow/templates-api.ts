import { createApiClient } from "@/lib/api-client";
import type { WorkflowDocument } from "@/features/workflow/api";
import type { WorkflowGraph } from "@/features/workflow/types";

const BASE = "/api/v1/workflow-templates";

export type WorkflowTemplateStatus = "draft" | "published" | "archived";

export interface WorkflowTemplateSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  status: WorkflowTemplateStatus;
  version: number;
  isFeatured: boolean;
  sortOrder: number;
  useCount: number;
  nodeCount: number;
  textInputCount: number;
  imageInputCount: number;
  outputKinds: string[];
  updatedAt: string;
  publishedAt: string | null;
}

export interface WorkflowTemplateDocument {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  schemaVersion: number;
  graph: WorkflowGraph | null;
  status: WorkflowTemplateStatus;
  version: number;
  isFeatured: boolean;
  sortOrder: number;
  useCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface WorkflowTemplateInput {
  name: string;
  description: string;
  category: string;
  tags: string[];
  schemaVersion: number;
  graph: WorkflowGraph;
  isFeatured: boolean;
  sortOrder: number;
}

export class WorkflowTemplateApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = "WorkflowTemplateApiError";
  }
}

const request = createApiClient({
  baseUrl: BASE,
  networkErrorMessage: "Failed to reach the workflow template API",
  createError: ({ code, details, status, fallbackMessage }) =>
    new WorkflowTemplateApiError(details[0] ?? code ?? fallbackMessage, status, details),
});

export function listWorkflowTemplates(
  search = "",
  category = "",
): Promise<{ templates: WorkflowTemplateSummary[] }> {
  const query = new URLSearchParams();
  if (search.trim()) query.set("search", search.trim());
  if (category.trim()) query.set("category", category.trim());
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return request(suffix);
}

export function getWorkflowTemplate(id: string): Promise<WorkflowTemplateDocument> {
  return request(`/${encodeURIComponent(id)}`);
}

export function instantiateWorkflowTemplate(id: string, name?: string): Promise<WorkflowDocument> {
  return request(`/${encodeURIComponent(id)}/instantiate`, {
    method: "POST",
    body: JSON.stringify({ name: name?.trim() || null }),
  });
}
