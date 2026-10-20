"use client";

import { useState } from "react";
import { WorkflowApiError, type WorkflowClient } from "../../api";
import type { WorkflowPartialRerunPreview, WorkflowRun } from "../../types";
import { useCommandLock } from "../../controllers/use-command-lock";
import { useRunCreation } from "../../controllers/use-run-creation";
import { accessDenied, errorMessage } from "../../controllers/run-errors";
import { parseInputs, type WorkflowV2Graph } from "../types";
import type { NodeDebugRequest } from "./use-node-debug";
import type { WorkflowDraft } from "./use-workflow-draft";
import type { WorkflowRuns } from "./use-workflow-runs";

type Command = "save" | "restart" | "resume" | "partial" | "preview" | "cancel" | "debug" | "retry-node" | "skip-node" | "rollback";
type PartialPreview = {
  preview: WorkflowPartialRerunPreview;
  graph: WorkflowV2Graph;
  run: WorkflowRun;
};

export function useWorkflowActions({
  draft,
  runs,
  client,
  showRun,
  setError,
}: {
  draft: WorkflowDraft;
  runs: WorkflowRuns;
  client: WorkflowClient;
  showRun: (run: WorkflowRun) => void;
  setError: (error: string | null) => void;
}) {
  const { document, graph } = draft;
  const lock = useCommandLock<Command>(document.id);
  const creation = useRunCreation(document.id, client, showRun);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [debugPending, setDebugPending] = useState<Record<string, NodeDebugRequest>>({});
  const [resultsVersion, setResultsVersion] = useState(0);
  const [partial, setPartial] = useState<PartialPreview | null>(null);
  const fields = graph.nodes.find((node) => node.type === "start")?.data.fields ?? [];
  function rememberDebugRequest(nodeId: string, request: NodeDebugRequest | null) {
    setDebugPending((current) => {
      const next = { ...current };
      if (request) next[nodeId] = request;
      else delete next[nodeId];
      return next;
    });
  }
  function clearResults() {
    setResultsVersion((value) => value + 1);
    setPartial(null);
    setDebugPending({});
    setInputs({});
    creation.clear();
  }
  async function action(
    command: Command,
    operation: (current: () => boolean) => Promise<boolean | void>,
  ) {
    const lease = lock.acquire(command);
    if (!lease) return false;
    setError(null);
    try {
      return (await operation(lease.current)) !== false && lease.current();
    } catch (reason) {
      if (lease.current()) {
        if (accessDenied(reason)) {
          runs.clear();
          clearResults();
        }
        setError(errorMessage(reason));
      }
      return false;
    } finally {
      lease.release();
    }
  }
  const save = (name?: string) => action("save", () => draft.save(name));
  function requireConfirmedDebug() {
    if (Object.keys(debugPending).length) throw new Error("调试提交尚未确认，请先确认原调试任务。");
    if (runs.debugActive) throw new Error("已有独立调试在排队或执行中。");
  }
  async function execute() {
    return action("restart", async (current) => {
      if (creation.uncertain) return creation.recover();
      requireConfirmedDebug();
      if (runs.active) throw new Error("已有运行在排队或执行中。");
      const parsed = parseInputs(fields, inputs);
      if (!(await draft.save()) || !current()) return false;
      await creation.create("restart", document.id, runs.run?.id ?? null, () =>
        client.startWorkflowRun(document.id, parsed),
      );
    });
  }
  async function preview(nodeId: string) {
    const run = runs.run;
    if (!run) return;
    return action("preview", async (current) => {
      const [value, snapshot] = await Promise.all([
        client.previewPartialWorkflowRerun(document.id, run.id, nodeId),
        client.getWorkflowRunSnapshot(document.id, run.id),
      ]);
      if (!current()) return;
      if (snapshot.runId !== value.sourceRunId || snapshot.graph.schemaVersion !== 1)
        throw new Error("重跑范围与原图快照不一致，请重新查询。");
      setPartial({ preview: value, graph: snapshot.graph as WorkflowV2Graph, run });
    });
  }
  async function confirmPartial() {
    if (!partial || partial.run.id !== runs.run?.id) return;
    return action("partial", async (current) => {
      requireConfirmedDebug();
      await creation.create("partial", document.id, partial.preview.sourceRunId, () =>
        client.partialRerunWorkflow(
          document.id,
          partial.preview.sourceRunId,
          partial.preview.fromNodeId,
        ),
      );
      if (current()) setPartial(null);
    });
  }
  async function resume() {
    const run = runs.run;
    if (run)
      return action("resume", () => {
        requireConfirmedDebug();
        return creation.create("resume", document.id, run.id, () =>
          client.resumeWorkflowRun(document.id, run.id),
        );
      });
  }
  async function cancel() {
    const run = runs.run;
    if (run)
      return action("cancel", async (current) => {
        await client.cancelWorkflowRun(document.id, run.id);
        if (current()) await runs.refreshAfterMutation();
      });
  }
  async function retryNode(nodeId: string) {
    const run = runs.run;
    if (!run) return;
    return action("retry-node", async (current) => {
      await creation.create("partial", document.id, run.id, () => client.retryWorkflowNode(document.id, run.id, nodeId));
      if (current()) runs.refreshAfterMutation();
    });
  }
  async function skipNode(nodeId: string) {
    const run = runs.run;
    if (!run) return;
    return action("skip-node", async (current) => {
      await client.skipWorkflowNode(document.id, run.id, nodeId);
      if (current()) await runs.refreshAfterMutation();
    });
  }
  async function rollback(fromNodeId: string) {
    const run = runs.run;
    if (!run) return;
    return action("rollback", async (current) => {
      await creation.create("partial", document.id, run.id, () => client.rollbackWorkflowRun(document.id, run.id, fromNodeId));
      if (current()) setPartial(null);
    });
  }
  async function submitDebug(nodeId: string, request: NodeDebugRequest) {
    if (creation.uncertain) throw new Error("整图提交尚未确认，请先查询原任务。");
    const lease = lock.acquire("debug");
    if (!lease) throw new Error("正在保存或提交，请稍后再试。");
    try {
      if (!(await draft.save()) || !lease.current())
        throw new Error("草稿已变化，请重新保存后调试。");
      const value = await client.startNodeDebug(document.id, nodeId, request);
      if (lease.current()) {
        runs.setDebugRun(value);
        rememberDebugRequest(nodeId, null);
      }
      return value;
    } catch (reason) {
      if (
        lease.current() &&
        reason instanceof WorkflowApiError &&
        reason.status >= 400 &&
        reason.status < 500
      )
        rememberDebugRequest(nodeId, null);
      throw reason;
    } finally {
      lease.release();
    }
  }
  const state = lock.pending
    ? { status: "executing" as const, command: lock.pending }
    : creation.uncertain
      ? { status: "uncertain" as const, command: creation.uncertain.command }
      : { status: "idle" as const };
  return {
    state,
    resultsVersion,
    busy: lock.pending !== null,
    fields,
    inputs,
    setInputs,
    debugPending,
    partial: partial?.run.id === runs.run?.id ? partial : null,
    clearPartial: () => setPartial(null),
    clearResults,
    rememberDebugRequest,
    save,
    execute,
    preview,
    confirmPartial,
    resume,
    cancel,
    retryNode,
    skipNode,
    rollback,
    submitDebug,
  };
}
export type WorkflowActions = ReturnType<typeof useWorkflowActions>;
