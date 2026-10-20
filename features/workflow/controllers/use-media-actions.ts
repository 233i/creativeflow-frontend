"use client";

import { useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import * as adminApi from "@/features/admin/api";
import type { WorkflowClient } from "../api";
import { useWorkflowStore } from "../store";
import { validateWorkflow, type WorkflowValidationIssue } from "../validation";
import { useCommandLock } from "./use-command-lock";
import { useRunCreation } from "./use-run-creation";
import { accessDenied, errorMessage } from "./run-errors";
import type { WorkflowEditorSource } from "./editor-types";
import type { WorkflowDocumentSession } from "./use-workflow-document";
import type { MediaDraft } from "./use-media-draft";
import type { MediaPartialRerun } from "./use-media-partial-rerun";
import type { useMediaRuns } from "./use-media-runs";

type Command = "restart" | "resume" | "partial" | "cancel";
export function useMediaActions({
  source,
  client,
  session,
  draft,
  runs,
  partial,
  videoExtensionSupported,
}: {
  source: WorkflowEditorSource;
  client: WorkflowClient;
  session: WorkflowDocumentSession;
  draft: MediaDraft;
  runs: ReturnType<typeof useMediaRuns>;
  partial: MediaPartialRerun;
  videoExtensionSupported: boolean;
}) {
  const t = useT();
  const { executionWorkflowId, setExecutionWorkflowId, setError } = session;
  const [issues, setIssues] = useState<WorkflowValidationIssue[]>([]);
  const lock = useCommandLock<Command>(source.id);
  const creation = useRunCreation(source.id, client, (value) => {
    partial.clear();
    runs.setRun(value);
  });
  async function action(command: Command, operation: (current: () => boolean) => Promise<void>) {
    const lease = lock.acquire(command);
    if (!lease) return;
    setError(null);
    try {
      await operation(lease.current);
    } catch (reason) {
      if (lease.current()) {
        if (accessDenied(reason)) {
          runs.setRun(null);
          partial.clear();
          creation.clear();
        }
        setError(errorMessage(reason, t("errors.unknown")));
      }
    } finally {
      lease.release();
    }
  }
  function validate() {
    const state = useWorkflowStore.getState();
    const validation = validateWorkflow(
      { nodes: state.nodes, edges: state.edges },
      { videoExtensionSupported },
    );
    setIssues(validation);
    if (!validation.length) setError(null);
    return validation.length === 0;
  }
  async function execute() {
    if (partial.selection || runs.active) return;
    if (
      !creation.uncertain &&
      runs.run?.status === "failed" &&
      !window.confirm(t("workflow.restartConfirm"))
    )
      return;
    await action("restart", async (current) => {
      if (creation.uncertain) return creation.recover();
      if (!validate() || !(await draft.save()) || !current()) return;
      let workflowId = executionWorkflowId;
      if (source.kind === "template") {
        const debug = await adminApi.prepareWorkflowTemplateDebug(source.id);
        if (!current()) return;
        workflowId = debug.id;
        setExecutionWorkflowId(debug.id);
      }
      if (!workflowId) throw new Error("模板调试工作流尚未准备完成");
      const id = workflowId;
      await creation.create("restart", id, runs.run?.id ?? null, () => client.startWorkflowRun(id));
    });
  }
  async function resume() {
    const run = runs.run;
    if (!run || run.status !== "failed" || !executionWorkflowId) return;
    await action("resume", () =>
      creation.create("resume", executionWorkflowId, run.id, () =>
        client.resumeWorkflowRun(executionWorkflowId, run.id),
      ),
    );
  }
  async function confirmPartial() {
    const preview = partial.selection?.preview;
    if (!preview || preview.sourceRunId !== runs.run?.id || !executionWorkflowId) return;
    await action("partial", () =>
      creation.create("partial", executionWorkflowId, preview.sourceRunId, () =>
        client.partialRerunWorkflow(executionWorkflowId, preview.sourceRunId, preview.fromNodeId),
      ),
    );
  }
  async function cancel() {
    const run = runs.run;
    if (!run || !runs.active || !executionWorkflowId) return;
    await action("cancel", async (current) => {
      await client.cancelWorkflowRun(executionWorkflowId, run.id);
      if (current()) await runs.refreshAfterMutation();
    });
  }
  return {
    issues,
    setIssues,
    validate,
    execute,
    resume,
    cancel,
    confirmPartial,
    clearUncertain: creation.clear,
    busy: lock.pending !== null,
    runAction: lock.pending === "cancel" ? null : lock.pending,
    state: lock.pending
      ? { status: "executing" as const, command: lock.pending }
      : creation.uncertain
        ? { status: "uncertain" as const, command: creation.uncertain.command }
        : { status: "idle" as const },
  };
}
export type MediaActions = ReturnType<typeof useMediaActions>;
