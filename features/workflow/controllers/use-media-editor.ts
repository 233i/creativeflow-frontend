"use client";

import { useMemo, useState } from "react";
import { useAiStore } from "@/features/ai/store";
import { resolveVideoExtensionModel } from "@/features/ai/video-models";
import type { WorkflowClient } from "../api";
import { useWorkflowStore } from "../store";
import { useEditorSession, useWorkflowDetail } from "../editor-session";
import type { WorkflowEditorSource } from "./editor-types";
import type { WorkflowDocumentSession } from "./use-workflow-document";
import { useMediaDraft } from "./use-media-draft";
import { useMediaRuns } from "./use-media-runs";
import { useMediaPartialRerun } from "./use-media-partial-rerun";
import { useMediaActions } from "./use-media-actions";
import { useMediaFiles } from "./use-media-files";
import { useTemplateActions } from "./use-template-actions";
import { useMediaCanvas } from "./use-media-canvas";
import { useMediaPanels } from "./use-media-panels";
import { useMediaPresentation } from "./use-media-presentation";

/** Composition only: each controller owns its lifecycle and command/query contract. */
export function useMediaEditor(
  source: WorkflowEditorSource,
  client: WorkflowClient,
  session: WorkflowDocumentSession,
) {
  const detail = useWorkflowDetail();
  const canvas = useMediaCanvas();
  const draft = useMediaDraft(source, client, session);
  const run = useWorkflowStore((state) => state.run);
  const partial = useMediaPartialRerun(session.executionWorkflowId, client, run, () =>
    session.setError("运行或资源访问权限已失效，已清除本页结果。"),
  );
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const runs = useMediaRuns({
    workflowId: session.executionWorkflowId,
    client,
    admin: source.kind === "api",
    managed: !!detail,
    setError: session.setError,
    setConnectionError,
    onDenied: () => {
      partial.clear();
      actions.clearUncertain();
    },
  });
  const providers = useAiStore((state) => state.providers);
  const videoSlot = useAiStore((state) => state.slots.video);
  const videoExtensionSupported = resolveVideoExtensionModel(providers, videoSlot) !== null;
  const actions = useMediaActions({
    source,
    client,
    session,
    draft,
    runs,
    partial,
    videoExtensionSupported,
  });
  const template = useTemplateActions(source, draft, runs.active, session.setError);
  const files = useMediaFiles(source, session, draft, runs.active, () => actions.setIssues([]));
  const panels = useMediaPanels(run);
  const sourceNodeIds = useMemo(
    () =>
      partial.selection ? new Set(partial.selection.source.nodes.map((node) => node.nodeId)) : null,
    [partial.selection],
  );
  const graph = useMemo(
    () => ({ nodes: canvas.nodes, edges: canvas.edges, externalApi: canvas.externalApi }),
    [canvas.nodes, canvas.edges, canvas.externalApi],
  );
  const displayedGraph = partial.selection
    ? (partial.selection.graph ?? { nodes: [], edges: [] })
    : graph;
  const presentation = useMediaPresentation(
    displayedGraph,
    run,
    sourceNodeIds,
    partial.selection?.preview ?? null,
  );
  useEditorSession(
    session.document,
    graph,
    draft.dirty,
    actions.busy || template.publishing,
    draft.save,
    runs.active,
  );
  return {
    source,
    session,
    draft,
    runs,
    actions,
    partial,
    template,
    files,
    panels,
    canvas,
    presentation,
    sourceNodeIds,
    connectionError,
  };
}
export type MediaEditorModel = ReturnType<typeof useMediaEditor>;
