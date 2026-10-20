"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { WorkflowClient } from "../api";
import type { WorkflowRun } from "../types";
import { accessDenied, submissionUncertain } from "./run-errors";
import { useRequestScope } from "./use-request-scope";

export type CreationCommand = "restart" | "resume" | "partial";
interface UnconfirmedSubmission {
  command: CreationCommand;
  previousRunId: string | null;
  workflowId: string;
}

/** Recovery never POSTs. A lost response cannot turn a query retry into a second task. */
export function useRunCreation(
  key: string,
  client: WorkflowClient,
  onRun: (run: WorkflowRun) => void,
) {
  const capture = useRequestScope(key);
  const request = useRef<UnconfirmedSubmission | null>(null);
  const [confirmation, setConfirmation] = useState<{
    key: string;
    submission: UnconfirmedSubmission | null;
  }>({ key, submission: null });
  const uncertain = confirmation.key === key ? confirmation.submission : null;
  useLayoutEffect(() => {
    request.current = null;
  }, [key]);
  function remember(value: UnconfirmedSubmission | null) {
    request.current = value;
    setConfirmation({ key, submission: value });
  }
  async function recover() {
    const pending = request.current;
    if (!pending) return;
    const current = capture();
    const latest = await client.getLatestWorkflowRun(pending.workflowId);
    if (!current()) return;
    if (latest && !latest.debugNodeId && latest.id !== pending.previousRunId) {
      remember(null);
      onRun(latest);
    } else throw new Error("提交结果仍未确认，请继续查询；没有重新提交任务。");
  }
  async function create(
    command: CreationCommand,
    workflowId: string,
    previousRunId: string | null,
    submit: () => Promise<WorkflowRun>,
  ) {
    if (request.current) return recover();
    const current = capture();
    try {
      const value = await submit();
      if (current()) onRun(value);
    } catch (reason) {
      if (!current()) return;
      if (submissionUncertain(reason)) remember({ command, previousRunId, workflowId });
      const latest = await client.getLatestWorkflowRun(workflowId).catch((cause) => {
        if (accessDenied(cause)) throw cause;
        return null;
      });
      if (!current()) return;
      if (latest && !latest.debugNodeId && latest.id !== previousRunId) {
        remember(null);
        onRun(latest);
      }
      throw reason;
    }
  }
  return { uncertain, recover, create, clear: () => remember(null) };
}
