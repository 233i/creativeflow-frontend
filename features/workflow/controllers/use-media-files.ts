"use client";

import { useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { useT } from "@/components/providers/i18n-provider";
import { exportWorkflow, importWorkflow, MAX_WORKFLOW_FILE_BYTES } from "../persistence";
import { useWorkflowStoreApi } from "../store";
import { downloadJson } from "@/lib/download";
import type { WorkflowEditorSource } from "./editor-types";
import type { WorkflowDocumentSession } from "./use-workflow-document";
import type { MediaDraft } from "./use-media-draft";
import { useRequestScope } from "./use-request-scope";

export function useMediaFiles(
  source: WorkflowEditorSource,
  session: WorkflowDocumentSession,
  draft: MediaDraft,
  active: boolean,
  clearIssues: () => void,
) {
  const t = useT();
  const storeApi = useWorkflowStoreApi();
  const { fitView } = useReactFlow();
  const inputRef = useRef<HTMLInputElement>(null);
  const capture = useRequestScope(source.id);
  async function importFile(file: File) {
    if (active) return;
    session.setError(null);
    if (file.size > MAX_WORKFLOW_FILE_BYTES) {
      session.setError(t("workflow.importTooLarge"));
      return;
    }
    const current = capture();
    try {
      const result = importWorkflow(await file.text());
      if (!current()) return;
      if (!result.ok) {
        session.setError(t("workflow.importFailed", { detail: result.detail }));
        return;
      }
      storeApi.getState().load(result.graph);
      clearIssues();
      if (!(await draft.save()) || !current()) return;
      window.requestAnimationFrame(() => {
        if (current()) void fitView({ duration: 200, minZoom: 0.25, maxZoom: 1, padding: 0.18 });
      });
    } catch (reason) {
      if (current())
        session.setError(reason instanceof Error ? reason.message : t("errors.unknown"));
    }
  }
  function exportFile() {
    if (!session.document) return;
    const { nodes, edges, externalApi } = storeApi.getState();
    downloadJson(
      `creativeflow-${source.kind === "template" ? "template" : "workflow"}-${source.id.slice(0, 8)}.json`,
      exportWorkflow(session.document.name, { nodes, edges, externalApi }),
    );
  }
  return { inputRef, importFile, exportFile };
}
