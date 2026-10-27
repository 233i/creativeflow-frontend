"use client";

import { useEffect, useRef, useState } from "react";
import type { WorkflowClient } from "../../api";
import type { WorkflowRun } from "../../types";
import { accessDenied } from "../../controllers/run-errors";
import { useRunQuery } from "../../controllers/use-run-query";

export const runActive = (run: Pick<WorkflowRun, "status"> | null) =>
  run?.status === "queued" || run?.status === "running";

/** Whole-run results and independent node debugging retain separate state and query scopes. */
export function useWorkflowRuns(
  workflowId: string,
  initialRun: WorkflowRun | null,
  client: WorkflowClient,
  admin: boolean,
  onDenied: (kind: "run" | "debug", message: string) => void,
) {
  const [run, setRun] = useState(initialRun?.debugNodeId ? null : initialRun);
  const [debugRun, setDebugRun] = useState<WorkflowRun | null>(
    initialRun?.debugNodeId ? initialRun : null,
  );
  const [clock, setClock] = useState(Date.now);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const restoreGeneration = useRef(0);
  const active = runActive(run);
  const debugActive = runActive(debugRun);
  const knowledgeRun = run?.nodes.some((node) =>
    ["knowledgeRetrieve", "knowledgeAnswer", "httpRequest"].includes(String(node.nodeType)),
  );
  function failed(kind: "run" | "debug", reason: unknown) {
    if (accessDenied(reason)) {
      restoreGeneration.current += 1;
      if (kind === "run") setRun(null);
      else setDebugRun(null);
      setConnectionError(null);
      onDenied(
        kind,
        kind === "run"
          ? "运行或资源访问权限已失效，已清除本页结果。请重新登录或联系管理员授权。"
          : "调试运行已不可访问。",
      );
    } else
      setConnectionError(
        kind === "run"
          ? "暂时无法查询运行状态，正在继续查询；没有重新提交任务。"
          : "调试状态暂时无法查询，没有重新提交。",
      );
  }
  const wholeQuery = useRunQuery({
    client,
    workflowId,
    runId: run?.id ?? null,
    interval: active || knowledgeRun ? 1500 : admin ? 10000 : null,
    backgroundRunning: active,
    onResult: (value) => {
      setRun(value);
      setConnectionError(null);
    },
    onError: (reason) => failed("run", reason),
    onTick: () => setClock(Date.now()),
  });
  const debugQuery = useRunQuery({
    client,
    workflowId,
    runId: debugRun?.id ?? null,
    interval: debugActive ? 1500 : 10000,
    backgroundRunning: debugActive,
    onResult: (value) => {
      setDebugRun(value);
      setClock(Date.now());
      setConnectionError(null);
    },
    onError: (reason) => failed("debug", reason),
  });
  useEffect(() => {
    let disposed = false;
    const generation = restoreGeneration.current;
    void client
      .listWorkflowRuns(workflowId)
      .then(async (value) => {
        const pending = value.runs.find((item) => item.debugNodeId && runActive(item));
        if (!pending || disposed) return;
        const restored = await client.getWorkflowRun(workflowId, pending.id);
        if (!disposed && generation === restoreGeneration.current)
          setDebugRun((current) => current ?? restored);
      })
      .catch(() => {
        /* A failed history read does not mean the task failed. */
      });
    return () => {
      disposed = true;
    };
  }, [client, workflowId]);
  function selectRun(value: WorkflowRun | null) {
    wholeQuery.invalidate();
    setRun(value);
  }
  function selectDebugRun(value: WorkflowRun | null) {
    restoreGeneration.current += 1;
    debugQuery.invalidate();
    setDebugRun(value);
  }
  function clear() {
    selectRun(null);
    selectDebugRun(null);
    setConnectionError(null);
  }
  return {
    run,
    debugRun,
    active,
    debugActive,
    clock,
    setClock,
    connectionError,
    setRun: selectRun,
    setDebugRun: selectDebugRun,
    refresh: wholeQuery.refresh,
    refreshAfterMutation: wholeQuery.refreshAfterMutation,
    refreshDebug: debugQuery.refresh,
    clear,
  };
}
export type WorkflowRuns = ReturnType<typeof useWorkflowRuns>;
