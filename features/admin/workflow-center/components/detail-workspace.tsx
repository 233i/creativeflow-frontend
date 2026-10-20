"use client";
import { ReadonlyTemplate } from "@/features/admin/workflow-center/readonly-template";
import { WorkflowRunRecords } from "@/features/admin/workflow-center/run-records";
import { WorkflowSettings } from "@/features/admin/workflow-center/settings";
import {
  WorkflowApiEditorPage,
  WorkflowTemplateEditorPage,
} from "@/features/workflow/workflow-page";
import type { WorkflowDetailController } from "../controllers/use-workflow-detail";
import { DetailPublication } from "./detail-publication";
export function DetailWorkspace({ controller }: { controller: WorkflowDetailController }) {
  const {
    id,
    source,
    section,
    document,
    setDocument,
    item,
    session,
    setDeleting,
    formBusy,
    current,
    publishedTemplate,
    registerForm,
  } = controller;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {document && (
        <>
          {/* React Flow 节点自带 visibility: visible；使用 hidden 隐藏整棵子树并保留编辑器状态。 */}
          <div
            className="absolute inset-0"
            hidden={section !== "edit"}
            inert={section !== "edit"}
            aria-hidden={section !== "edit"}
          >
            {publishedTemplate ? (
              document.graph && <ReadonlyTemplate graph={document.graph} />
            ) : source === "template" ? (
              <WorkflowTemplateEditorPage templateId={id} />
            ) : (
              <WorkflowApiEditorPage workflowId={id} />
            )}
          </div>
          <DetailPublication controller={controller} />
          {section === "runs" && item && (
            <div className="min-h-0 flex-1">
              <WorkflowRunRecords item={item} />
            </div>
          )}
          {section === "settings" && (
            <WorkflowSettings
              key={document.id}
              document={current!}
              template={source === "template" && "status" in document ? document : undefined}
              onSaveName={async (name) => (session ? session.save(name) : false)}
              onSaved={setDocument}
              register={registerForm}
              onDelete={() => setDeleting(true)}
              deleteDisabled={session?.busy || formBusy}
            />
          )}
        </>
      )}
    </div>
  );
}
