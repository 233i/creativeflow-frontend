"use client";

import { useWorkflowDetail } from "../editor-session";
import type { WorkflowClient } from "../api";
import { cn } from "@/lib/utils";
import { WorkflowTemplateMetadataDialog } from "./template-metadata-dialog";
import { WorkflowApiBindingDialog } from "../external-api/binding-dialog";
import { WorkflowPublishPanel } from "../external-api/publish-panel";
import { MEDIA_LIBRARY_KINDS, MEDIA_NODE_DRAG_MIME } from "../media-node-library";
import type { WorkflowNodeKind } from "../types";
import { isTemplateDocument, type WorkflowEditorSource } from "../controllers/editor-types";
import type { WorkflowDocumentSession } from "../controllers/use-workflow-document";
import { useMediaEditor } from "../controllers/use-media-editor";
import { MediaToolbar } from "./media-toolbar";
import { MediaCanvas } from "./media-canvas";
import { MediaPalette } from "./media-palette";
import { MediaErrors } from "./media-errors";
import { MediaRunInspector, MediaRunProgress } from "./media-run-inspector";

export function MediaEditor({
  source,
  client,
  session,
}: {
  source: WorkflowEditorSource;
  client: WorkflowClient;
  session: WorkflowDocumentSession;
}) {
  const detail = useWorkflowDetail();
  const editor = useMediaEditor(source, client, session);
  const { canvas, partial, runs, files, template, panels, draft } = editor;
  const { document, setDocument } = session;
  const { wrapperRef, externalApi } = canvas;
  const { inputRef } = files;
  if (!document) return null;
  const selecting = !!partial.selection;
  function locate(id: string) {
    const node = canvas.nodes.find((node) => node.id === id);
    if (!node) return;
    canvas.onNodesChange(
      canvas.nodes.map((item) => ({ id: item.id, type: "select", selected: item.id === id })),
    );
    if (detail) panels.inspectNode(id);
    void canvas.fitView({ nodes: [node], maxZoom: 1, duration: 200 });
  }
  return (
    <div className="flex h-full min-h-0 min-w-0">
      <div
        ref={wrapperRef}
        className={cn(
          "studio-canvas workflow-editor relative h-full min-w-0 flex-1 bg-canvas",
          selecting && "workflow-partial-rerun-selecting",
        )}
        onDragOver={(event) => {
          if (detail && !selecting && event.dataTransfer.types.includes(MEDIA_NODE_DRAG_MIME)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={(event) => {
          const kind = event.dataTransfer.getData(MEDIA_NODE_DRAG_MIME) as WorkflowNodeKind;
          if (
            !detail ||
            selecting ||
            canvas.nodes.length >= 40 ||
            !MEDIA_LIBRARY_KINDS.includes(kind)
          )
            return;
          event.preventDefault();
          canvas.addNode(kind, canvas.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
        }}
      >
        <MediaCanvas editor={editor} managed={!!detail} />
        <MediaToolbar editor={editor} />
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          disabled={runs.active || selecting}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void files.importFile(file);
          }}
        />
        <MediaPalette editor={editor} managed={!!detail} />
        <MediaErrors editor={editor} onLocate={locate} />
        {!detail && <MediaRunProgress editor={editor} />}
        {source.kind === "template" && template.metadataOpen && isTemplateDocument(document) && (
          <WorkflowTemplateMetadataDialog
            template={document}
            isOpen
            onOpenChange={template.setMetadataOpen}
            onSaved={setDocument}
          />
        )}
        {source.kind === "api" && <WorkflowApiBindingDialog />}
        {source.kind === "api" && (
          <WorkflowPublishPanel
            workflowId={source.id}
            workflowName={document.name}
            updatedAt={document.updatedAt}
            manifest={externalApi}
            isOpen={panels.publishPanelOpen}
            onOpenChange={panels.setPublishPanelOpen}
            onBeforePublish={draft.save}
          />
        )}
      </div>
      <MediaRunInspector editor={editor} />
    </div>
  );
}
