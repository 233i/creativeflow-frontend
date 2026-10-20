"use client";
import { useEffect, useRef, useState } from "react";
import { WorkflowApiError, type WorkflowClient, type WorkflowRunHistoryItem } from "../../api";
import type { WorkflowRun } from "../../types";
import { submissionRejected } from "../../controllers/run-errors";
import { useRequestScope } from "../../controllers/use-request-scope";
import { nodeInputLabel, parseInputs, type WorkflowV2Graph, type WorkflowV2Node } from "../types";
import { inputDraft } from "../field-input";
export interface NodeDebugRequest {
  requestId: string;
  inputs: Record<string, unknown>;
  sourceRunId?: string;
}

export interface NodeDebugPanelProps {
  workflowId: string;
  node: WorkflowV2Node;
  graph: WorkflowV2Graph;
  client: WorkflowClient;
  run: WorkflowRun | null;
  blocked: boolean;
  onRun: (run: WorkflowRun | null) => void;
  onSubmit: (request: NodeDebugRequest) => Promise<WorkflowRun>;
  onLocate: (id: string) => void;
  pendingRequest?: NodeDebugRequest | null;
  onPending?: (request: NodeDebugRequest | null) => void;
}

export function useNodeDebug({
  workflowId,
  node,
  client,
  run,
  blocked,
  onRun,
  onSubmit,
  pendingRequest,
  onPending,
}: NodeDebugPanelProps) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [source, setSource] = useState("");
  const [evidence, setEvidence] = useState<Record<string, unknown>>({});
  const [history, setHistory] = useState<WorkflowRunHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [localPending, setLocalPending] = useState<NodeDebugRequest | null>(null);
  const pending = pendingRequest === undefined ? localPending : pendingRequest;
  const setPending = onPending ?? setLocalPending;
  const [clock, setClock] = useState(Date.now);
  const lock = useRef(false);
  const capture = useRequestScope(`${workflowId}/${node.id}`);
  const active = run?.status === "queued" || run?.status === "running";
  const manual = node.data.fields
    .filter((field) => field.type !== "contextChunks" && field.type !== "answer")
    .map((field) => ({ ...field, label: nodeInputLabel(node.type, field) }));
  const knowledge = node.data.fields.filter(
    (field) => field.type === "contextChunks" || field.type === "answer",
  );
  useEffect(() => {
    let disposed = false;
    void client
      .listWorkflowRuns(workflowId)
      .then((value) => {
        if (!disposed) setHistory(value.runs);
      })
      .catch(() => {
        if (!disposed) setError("无法读取历史，请重新打开调试面板；没有提交任务。");
      });
    return () => {
      disposed = true;
    };
  }, [client, workflowId, run?.id, run?.status]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  async function operation(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const current = capture();
    try {
      await fn();
    } catch (cause) {
      if (current()) {
        if (cause instanceof WorkflowApiError && [401, 403, 404].includes(cause.status)) {
          setEvidence({});
          setDraft({});
          onRun(null);
        }
        setError(cause instanceof Error ? cause.message : "操作未完成，没有自动重试。");
      }
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }

  async function start(reconfirm = false) {
    const current = capture();
    await operation(async () => {
      if (active || blocked) throw new Error("已有任务在排队或执行，请先等待或停止任务。");
      const request =
        reconfirm && pending
          ? pending
          : {
              requestId: crypto.randomUUID(),
              inputs: parseInputs(manual, draft),
              ...(source ? { sourceRunId: source } : {}),
            };
      if (knowledge.length && !request.sourceRunId)
        throw new Error("知识证据只能来自历史运行，请先选择并载入历史输入。");
      if (!reconfirm && pending)
        throw new Error("上次提交状态未确认。请先重新确认该次提交，避免重复调用。");
      setPending(request);
      try {
        const value = await onSubmit(request);
        if (current()) {
          onRun(value);
          setPending(null);
        }
      } catch (cause) {
        // 明确的客户端拒绝表示未受理；网络/5xx 保留幂等请求，用户可重查同一次提交。
        if (submissionRejected(cause) && current()) setPending(null);
        throw cause;
      }
    });
  }

  function selectSource(next: string) {
    setSource(next);
    setEvidence({});
    setDraft({});
    if (!next) return;
    const current = capture();
    void operation(async () => {
      const value = await client.getNodeDebugInputs(workflowId, node.id, next);
      if (current()) {
        setEvidence(
          Object.fromEntries(knowledge.map((field) => [field.key, value.inputs[field.key]])),
        );
        setDraft(inputDraft(manual, value.inputs));
      }
    });
  }
  async function readRun(id: string, cancel = false) {
    const current = capture();
    await operation(async () => {
      if (cancel) await client.cancelWorkflowRun(workflowId, id);
      if (!current()) return;
      const value = await client.getWorkflowRun(workflowId, id);
      if (current()) onRun(value);
    });
  }
  return {
    draft,
    setDraft,
    source,
    selectSource,
    evidence,
    history,
    error,
    busy,
    pending,
    clock,
    active,
    manual,
    knowledge,
    start,
    readRun,
  };
}
