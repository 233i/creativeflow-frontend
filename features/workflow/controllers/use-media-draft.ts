"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import * as adminApi from "@/features/admin/api";
import type { WorkflowClient } from "../api";
import { useWorkflowStore, useWorkflowStoreApi } from "../store";
import type { WorkflowEditorSource } from "./editor-types";
import type { WorkflowDocumentSession } from "./use-workflow-document";
import { useRequestScope } from "./use-request-scope";
import { errorMessage } from "./run-errors";

type SaveState =
  | { status: "idle" | "saved" }
  | { status: "saving"; sequence: number }
  | { status: "failed"; message: string };

/** Captured snapshots are written in order. Only the latest revision can mark the draft saved. */
export function useMediaDraft(
  source: WorkflowEditorSource,
  client: WorkflowClient,
  session: WorkflowDocumentSession,
) {
  const { hydratedRef, setDocument, setError } = session;
  const storeApi = useWorkflowStoreApi();
  const t = useT();
  const revision = useWorkflowStore((state) => state.revision);
  const observedRevision = useRef(revision);
  const capture = useRequestScope(`${source.kind}/${source.id}`);
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));
  const sequence = useRef(0);
  const save = useCallback(
    (name?: string): Promise<boolean> => {
      if (!hydratedRef.current) return Promise.resolve(false);
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      const current = capture();
      const next = ++sequence.current;
      const snapshot = storeApi.getState();
      const graph = {
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        externalApi: snapshot.externalApi,
      };
      setState({ status: "saving", sequence: next });
      const pending = chain.current.then(async () => {
        if (!current()) return false;
        try {
          const saved =
            source.kind === "template"
              ? await adminApi.saveWorkflowTemplateGraph(source.id, graph)
              : await client.saveWorkflow(source.id, graph, name);
          if (!current()) return false;
          const latest = storeApi.getState();
          // Import resets the store revision. Data identity also detects an imported replacement,
          // while React Flow selection/measurement updates keep the same data objects.
          const unchanged =
            latest.revision === snapshot.revision &&
            latest.nodes.length === snapshot.nodes.length &&
            latest.nodes.every(
              (node, index) =>
                node.id === snapshot.nodes[index].id && node.data === snapshot.nodes[index].data,
            ) &&
            latest.externalApi === snapshot.externalApi;
          if (next === sequence.current && unchanged) {
            setDocument(saved);
            setState({ status: "saved" });
            setError(null);
          }
          return unchanged;
        } catch (reason) {
          if (current() && next === sequence.current) {
            const message = errorMessage(reason, t("errors.unknown"));
            setState({ status: "failed", message });
            setError(message);
          }
          return false;
        }
      });
      chain.current = pending;
      return pending;
    },
    [capture, client, hydratedRef, setDocument, setError, source, t, storeApi],
  );
  useEffect(() => {
    if (!hydratedRef.current || observedRevision.current === revision) return;
    observedRevision.current = revision;
    if (timer.current) clearTimeout(timer.current);
    setState({ status: "saving", sequence: sequence.current + 1 });
    timer.current = setTimeout(() => void save(), 500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [hydratedRef, revision, save]);
  return { state, save, dirty: state.status === "saving" || state.status === "failed" };
}
export type MediaDraft = ReturnType<typeof useMediaDraft>;
