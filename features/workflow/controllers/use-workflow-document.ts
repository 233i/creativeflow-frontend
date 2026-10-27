"use client";
import { useEffect, useRef, useState } from "react";
import {
  useWorkspacePage,
  useWorkspaceRouter as useRouter,
} from "@/components/providers/workspace-context";
import { useReactFlow } from "@xyflow/react";
import { useT } from "@/components/providers/i18n-provider";
import * as api from "../api";
import type { WorkflowClient } from "../api";
import { useAiStore } from "@/features/ai/store";
import { useWorkflowStore } from "../store";
import { isTypedWorkflowGraph, type WorkflowRun } from "../types";
import type { WorkflowEditorDocument, WorkflowEditorSource } from "./editor-types";
import { loadEditorDocument } from "./load-editor-document";

export function useWorkflowDocument(source: WorkflowEditorSource, workflowApi: WorkflowClient) {
  const t = useT();
  const router = useRouter();
  const adminVerified = !!useWorkspacePage();
  const { fitView } = useReactFlow();
  const load = useWorkflowStore((state) => state.load);
  const setRun = useWorkflowStore((state) => state.setRun);
  const loadAi = useAiStore((state) => state.load);
  const refreshAdminAi = useAiStore((state) => state.refreshAdmin);
  const [document, setDocument] = useState<WorkflowEditorDocument | null>(null);
  const [v2Document, setV2Document] = useState<{
    document: api.WorkflowDocument;
    run: WorkflowRun | null;
    accessError?: string;
  } | null>(null);
  const [executionWorkflowId, setExecutionWorkflowId] = useState<string | null>(
    source.kind !== "template" ? source.id : null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    hydratedRef.current = false;
    void (async () => {
      try {
        const loaded = await loadEditorDocument(source, workflowApi, {
          current: () => !cancelled,
          loadAi,
          refreshAdminAi,
          adminVerified,
        });
        if (cancelled || !loaded) return;
        if ("redirect" in loaded) {
          router.replace(loaded.redirect);
          return;
        }
        const {
          document: loadedDocument,
          workflowId: runWorkflowId,
          run: latest,
          accessError,
        } = loaded;
        if (cancelled) return;
        if (!loadedDocument.graph) throw new Error(t("workflow.invalidStoredGraph"));
        if (source.kind !== "template" && isTypedWorkflowGraph(loadedDocument.graph)) {
          setV2Document({
            document: loadedDocument as api.WorkflowDocument,
            run: latest,
            accessError,
          });
          setLoading(false);
          return;
        }
        setDocument(loadedDocument);
        setExecutionWorkflowId(runWorkflowId);
        load(loadedDocument.graph);
        setRun(latest);
        hydratedRef.current = true;
        setLoading(false);
        window.requestAnimationFrame(() => {
          if (!cancelled) void fitView({ duration: 200, minZoom: 0.25, maxZoom: 1, padding: 0.18 });
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t("errors.unknown"));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      hydratedRef.current = false;
    };
  }, [
    adminVerified,
    fitView,
    load,
    loadAi,
    refreshAdminAi,
    router,
    setRun,
    source,
    t,
    workflowApi,
  ]);

  return {
    document,
    setDocument,
    v2Document,
    executionWorkflowId,
    setExecutionWorkflowId,
    loading,
    error,
    setError,
    hydratedRef,
  };
}
export type WorkflowDocumentSession = ReturnType<typeof useWorkflowDocument>;
