"use client";

import { useRef, useState } from "react";
import type { WorkflowClient } from "../api";
import { useWorkflowStore } from "../store";
import type { WorkflowGraph, WorkflowPartialRerunPreview, WorkflowRun } from "../types";
import { useRequestScope } from "./use-request-scope";
import { accessDenied, errorMessage } from "./run-errors";

type Selection =
  | { status: "idle" }
  | {
      status: "selecting";
      source: WorkflowRun;
      graph: WorkflowGraph | null;
      preview: WorkflowPartialRerunPreview | null;
      pendingNodeId: string | null;
      error: string | null;
    };

export function useMediaPartialRerun(
  workflowId: string | null,
  client: WorkflowClient,
  run: WorkflowRun | null,
  onDenied?: (reason: unknown) => void,
) {
  const capture = useRequestScope(`${workflowId}/${run?.id}`);
  const sequence = useRef(0);
  const [state, setState] = useState<Selection>({ status: "idle" });
  const selection = state.status === "selecting" && state.source.id === run?.id ? state : null;
  function clear() {
    sequence.current += 1;
    setState({ status: "idle" });
  }
  async function begin() {
    if (!workflowId || run?.status !== "succeeded") return;
    const current = capture();
    const request = ++sequence.current;
    const isLatest = () => current() && request === sequence.current;
    setState({
      status: "selecting",
      source: run,
      graph: null,
      preview: null,
      pendingNodeId: null,
      error: null,
    });
    try {
      const snapshot = await client.getWorkflowRunSnapshot(workflowId, run.id);
      if (!isLatest()) return;
      if (snapshot.runId !== run.id) throw new Error("原运行快照不一致，请重新查询。");
      setState((value) =>
        value.status === "selecting" ? { ...value, graph: snapshot.graph } : value,
      );
    } catch (reason) {
      if (isLatest() && accessDenied(reason)) {
        clear();
        useWorkflowStore.getState().setRun(null);
        onDenied?.(reason);
        return;
      }
      if (isLatest())
        setState((value) =>
          value.status === "selecting"
            ? { ...value, error: errorMessage(reason, "原运行快照读取失败") }
            : value,
        );
    }
  }
  async function choose(nodeId: string) {
    if (
      !selection?.graph ||
      !workflowId ||
      !selection.source.nodes.some((node) => node.nodeId === nodeId)
    )
      return;
    const sourceId = selection.source.id;
    const current = capture();
    const request = ++sequence.current;
    const isLatest = () => current() && request === sequence.current;
    setState({ ...selection, preview: null, pendingNodeId: nodeId, error: null });
    try {
      const preview = await client.previewPartialWorkflowRerun(workflowId, sourceId, nodeId);
      if (
        !current() ||
        request !== sequence.current ||
        useWorkflowStore.getState().run?.id !== sourceId
      )
        return;
      if (preview.sourceRunId !== sourceId) throw new Error("重跑范围与原运行不一致，请重新查询。");
      setState((value) =>
        value.status === "selecting" ? { ...value, preview, pendingNodeId: null } : value,
      );
    } catch (reason) {
      if (isLatest() && accessDenied(reason)) {
        clear();
        useWorkflowStore.getState().setRun(null);
        onDenied?.(reason);
        return;
      }
      if (isLatest())
        setState((value) =>
          value.status === "selecting"
            ? { ...value, pendingNodeId: null, error: errorMessage(reason, "读取局部重跑范围失败") }
            : value,
        );
    }
  }
  return { selection, begin, choose, clear };
}
export type MediaPartialRerun = ReturnType<typeof useMediaPartialRerun>;
