import * as adminApi from "@/features/admin/api";
import { handshake, storedDeviceId } from "@/lib/device";
import { WorkflowApiError, type WorkflowClient } from "../api";
import { isTypedWorkflowGraph, type WorkflowRun } from "../types";
import type { WorkflowEditorDocument, WorkflowEditorSource } from "./editor-types";

interface Environment {
  current: () => boolean;
  loadAi: () => Promise<unknown>;
  refreshAdminAi: () => Promise<unknown>;
  adminVerified?: boolean;
}
type Loaded = {
  document: WorkflowEditorDocument;
  workflowId: string;
  run: WorkflowRun | null;
  accessError?: string;
};
export type EditorLoadResult = Loaded | { redirect: string } | null;

async function withLatest(
  document: WorkflowEditorDocument,
  workflowId: string,
  client: WorkflowClient,
): Promise<Loaded> {
  try {
    return { document, workflowId, run: await client.getLatestWorkflowRun(workflowId) };
  } catch (cause) {
    if (
      isTypedWorkflowGraph(document.graph) &&
      cause instanceof WorkflowApiError &&
      cause.status === 403
    )
      return {
        document,
        workflowId,
        run: null,
        accessError: "旧运行的知识访问权限已失效，结果未加载。可以修改知识资源并创建新运行。",
      };
    throw cause;
  }
}

async function loadTemplate(
  id: string,
  client: WorkflowClient,
  environment: Environment,
): Promise<EditorLoadResult> {
  await handshake();
  if (!environment.adminVerified)
    await environment.refreshAdminAi().catch(() => {
      /* Model settings must not block structural editing. */
    });
  if (!environment.current()) return null;
  const template = await adminApi.getWorkflowTemplate(id);
  if (!environment.current()) return null;
  if (template.status === "published") return { redirect: "/admin?tab=workflowTemplates" };
  const debug = await adminApi.prepareWorkflowTemplateDebug(id);
  if (!environment.current()) return null;
  return {
    document: template,
    workflowId: debug.id,
    run: await client.getLatestWorkflowRun(debug.id),
  };
}

/** Authorization and source adapters stay outside the rendered editor and its draft queue. */
export async function loadEditorDocument(
  source: WorkflowEditorSource,
  client: WorkflowClient,
  environment: Environment,
): Promise<EditorLoadResult> {
  if (source.kind !== "workflow") {
    if (!environment.adminVerified) {
      const me = await adminApi.getMe();
      if (!environment.current()) return null;
      if (!me.admin)
        return {
          redirect:
            source.kind === "api" ? "/admin?tab=workflowApis" : "/admin?tab=workflowTemplates",
        };
    }
    if (source.kind === "template") return loadTemplate(source.id, client, environment);
    if (!environment.adminVerified) await environment.refreshAdminAi().catch(() => {});
  } else {
    if (!storedDeviceId()) await handshake();
    await environment.loadAi();
  }
  if (!environment.current()) return null;
  const document = await client.getWorkflow(source.id);
  if (!environment.current()) return null;
  return withLatest(document, source.id, client);
}
