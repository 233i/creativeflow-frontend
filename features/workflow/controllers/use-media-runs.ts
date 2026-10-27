"use client";

import { useEffect } from "react";
import type { WorkflowClient } from "../api";
import { useWorkflowStore, useWorkflowStoreApi } from "../store";
import { subscribeWorkflowRuns } from "../realtime";
import { accessDenied } from "./run-errors";
import { useRunQuery } from "./use-run-query";

export function useMediaRuns({
  workflowId,
  client,
  admin,
  managed,
  setError,
  setConnectionError,
  onDenied,
}: {
  workflowId: string | null;
  client: WorkflowClient;
  admin: boolean;
  managed: boolean;
  setError: (error: string | null) => void;
  setConnectionError: (error: string | null) => void;
  onDenied: () => void;
}) {
  const run = useWorkflowStore((state) => state.run);
  const storeApi = useWorkflowStoreApi();
  const setRun = useWorkflowStore((state) => state.setRun);
  const applyRunEvent = useWorkflowStore((state) => state.applyRunEvent);
  const active = run?.status === "queued" || run?.status === "running";
  const { refresh, invalidate, refreshAfterMutation } = useRunQuery({
    client,
    workflowId,
    runId: run?.id ?? null,
    interval: active || managed ? (admin ? 2000 : 10000) : null,
    backgroundRunning: active,
    onResult: (value) => {
      if (storeApi.getState().run?.id === value.id) {
        setRun(value);
        setConnectionError(null);
      }
    },
    onError: (reason) => {
      if (storeApi.getState().run?.id !== run?.id) return;
      if (accessDenied(reason)) {
        setRun(null);
        onDenied();
        setConnectionError(null);
        setError("运行或资源访问权限已失效，已清除本页结果。");
      } else setConnectionError("连接中断，正在重新查询运行状态；不会重新提交任务。");
    },
  });
  useEffect(() => {
    if (admin || !workflowId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeWorkflowRuns((event) => {
      if (event.workflowId !== workflowId || event.runId !== storeApi.getState().run?.id) return;
      applyRunEvent(event);
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 80);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [admin, workflowId, applyRunEvent, refresh, storeApi]);
  return {
    run,
    active,
    refresh,
    refreshAfterMutation,
    setRun: (value: typeof run) => {
      invalidate();
      setRun(value);
    },
  };
}
