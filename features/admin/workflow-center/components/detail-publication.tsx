"use client";
import { TemplatePublishing } from "@/features/admin/workflow-center/components/template-publication";
import type { WorkflowDetailController } from "@/features/admin/workflow-center/controllers/use-workflow-detail";
import { v2PublicationManifest } from "@/features/workflow/external-api/contracts";
import { WorkflowPublishPanel } from "@/features/workflow/external-api/publish-panel";
import { isTypedWorkflowGraph } from "@/features/workflow/types";
import type { WorkflowV2Graph } from "@/features/workflow/v2/types";
export function DetailPublication({ controller }: { controller: WorkflowDetailController }) {
  const {
    id,
    source,
    section,
    document,
    setDocument,
    session,
    setRetry,
    current,
    select,
    registerForm,
  } = controller;
  if (!document) return null;
  const graph = session?.graph ?? document.graph;
  return (
    <>
      {(section === "publications" || section === "access") && (
        <div className="min-h-0 flex-1">
          {source === "template" && "status" in document ? (
            <TemplatePublishing
              template={document}
              section={section}
              onChange={(value) => {
                setDocument(value);
                setRetry((number) => number + 1);
              }}
              beforePublish={session?.save}
            />
          ) : (
            <WorkflowPublishPanel
              key={section}
              page={section}
              onPendingChange={registerForm}
              workflowId={id}
              workflowName={current!.name}
              updatedAt={current!.updatedAt}
              manifest={
                isTypedWorkflowGraph(graph)
                  ? v2PublicationManifest(graph as WorkflowV2Graph)
                  : (graph?.externalApi ?? {
                      schemaVersion: 1,
                      inputs: [],
                      outputs: [],
                    })
              }
              isOpen
              onOpenChange={() => select("edit")}
              onBeforePublish={async () => (session ? session.save() : false)}
            />
          )}
        </div>
      )}
    </>
  );
}
