"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { WorkflowClient } from "../api";
import type { WorkflowRun } from "../types";
import { useRequestScope } from "./use-request-scope";

interface Options {
  client: WorkflowClient;
  workflowId: string | null;
  runId: string | null;
  interval: number | null;
  onResult: (run: WorkflowRun) => void;
  onError: (reason: unknown) => void;
  onTick?: () => void;
}

/** Reads only: coalesces requests, pauses hidden pages, and rejects superseded responses. */
export function useRunQuery(options: Options) {
  const { client, workflowId, runId, interval } = options;
  const identity = useMemo(() => ({ client, workflowId, runId }), [client, workflowId, runId]);
  const capture = useRequestScope(identity);
  const callbacks = useRef(options);
  const pending = useRef<{ current: () => boolean; promise: Promise<void> } | null>(null);
  const sequence = useRef(0);
  useLayoutEffect(() => {
    callbacks.current = options;
  });
  const invalidate = useCallback(() => {
    sequence.current += 1;
  }, []);
  const refresh = useCallback((): Promise<void> => {
    if (!workflowId || !runId) return Promise.resolve();
    if (pending.current?.current()) return pending.current.promise;
    const inScope = capture();
    if (!inScope()) return Promise.resolve();
    const request = ++sequence.current;
    const current = () => inScope() && sequence.current === request;
    const promise = client
      .getWorkflowRun(workflowId, runId)
      .then(
        (value) => {
          if (current()) callbacks.current.onResult(value);
        },
        (reason) => {
          if (current()) callbacks.current.onError(reason);
        },
      )
      .finally(() => {
        if (pending.current?.promise === promise) pending.current = null;
      });
    pending.current = { current, promise };
    return promise;
  }, [capture, client, workflowId, runId]);
  useEffect(() => {
    if (interval === null || !runId) return;
    const tick = () => {
      callbacks.current.onTick?.();
      if (document.visibilityState !== "hidden") void refresh();
    };
    const visible = () => {
      if (document.visibilityState === "visible") tick();
    };
    const timer = window.setInterval(tick, interval);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [interval, runId, refresh]);
  useEffect(() => invalidate, [client, invalidate]);
  function refreshAfterMutation() {
    const current = capture();
    if (!current()) return Promise.resolve();
    invalidate();
    return refresh();
  }
  return { refresh, invalidate, refreshAfterMutation };
}
