"use client";
import { useMemo } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/providers/i18n-provider";
import * as api from "./api";
import * as workflowAdminApi from "@/features/admin/workflow-api";
import { WorkflowEditorEnvironmentContext } from "./editor-environment";
import type { WorkflowEditorSource } from "./controllers/editor-types";
import { useWorkflowDocument } from "./controllers/use-workflow-document";
import { WorkflowV2Editor } from "./v2/editor";
import { MediaEditor } from "./components/media-editor";
export function WorkflowPage({ workflowId }: { workflowId: string }) {
  const source = useMemo<WorkflowEditorSource>(
    () => ({ kind: "workflow", id: workflowId }),
    [workflowId],
  );
  return (
    <ReactFlowProvider>
      <WorkflowEditor key={workflowId} source={source} />
    </ReactFlowProvider>
  );
}

export function WorkflowTemplateEditorPage({ templateId }: { templateId: string }) {
  const source = useMemo<WorkflowEditorSource>(
    () => ({ kind: "template", id: templateId }),
    [templateId],
  );
  return (
    <ReactFlowProvider>
      <WorkflowEditor key={templateId} source={source} />
    </ReactFlowProvider>
  );
}

/** 后台 API 复用工作流画布、保存队列和调试执行逻辑。 */
export function WorkflowApiEditorPage({ workflowId }: { workflowId: string }) {
  const source = useMemo<WorkflowEditorSource>(
    () => ({ kind: "api", id: workflowId }),
    [workflowId],
  );
  const environment = useMemo(
    () => ({
      canManageApi: true,
      assets: workflowAdminApi.createWorkflowApiAssets(workflowId),
    }),
    [workflowId],
  );
  return (
    <WorkflowEditorEnvironmentContext.Provider value={environment}>
      <ReactFlowProvider>
        <WorkflowEditor key={workflowId} source={source} />
      </ReactFlowProvider>
    </WorkflowEditorEnvironmentContext.Provider>
  );
}

function WorkflowEditor({ source }: { source: WorkflowEditorSource }) {
  const t = useT();
  const client = source.kind === "api" ? workflowAdminApi.editorApi : api;
  const session = useWorkflowDocument(source, client);
  if (session.v2Document)
    return (
      <WorkflowV2Editor
        initialDocument={session.v2Document.document}
        initialRun={session.v2Document.run}
        initialError={session.v2Document.accessError}
        client={client}
        admin={source.kind === "api"}
      />
    );
  if (session.loading)
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t("common.loading")}
      </div>
    );
  if (!session.document)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm">
        <p className="text-destructive">{session.error ?? t("workflow.notFound")}</p>
        <Button variant="outline" onPress={() => window.location.reload()}>
          {t("common.retry")}
        </Button>
      </div>
    );
  return <MediaEditor source={source} client={client} session={session} />;
}
