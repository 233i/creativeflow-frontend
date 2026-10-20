import type { WorkflowDocument } from "../api";
import type { WorkflowTemplateDocument } from "../templates-api";

export type WorkflowEditorSource = { kind: "workflow" | "api" | "template"; id: string };
export type WorkflowEditorDocument = WorkflowDocument | WorkflowTemplateDocument;
export function isTemplateDocument(
  document: WorkflowEditorDocument,
): document is WorkflowTemplateDocument {
  return "status" in document;
}
