"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type createWorkflowApiClient, type WorkflowRunHistoryItem } from "../api";
import type { WorkflowRun } from "../types";
import { actionClass } from "./config-styles";

const labels = {
  queued: "排队中",
  running: "执行中",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

/** 历史选择不会覆盖当前草稿，也不会触发生成；正文在点击后重新鉴权。 */
export function V2RunHistory({
  workflowId,
  client,
  onClose,
  onSelect,
  onDenied,
}: {
  workflowId: string;
  client: ReturnType<typeof createWorkflowApiClient>;
  onClose: () => void;
  onSelect: (run: WorkflowRun) => void;
  onDenied: () => void;
}) {
  const [runs, setRuns] = useState<WorkflowRunHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const lock = useRef(false);
  useEffect(() => {
    let disposed = false;
    alive.current = true;
    void client
      .listWorkflowRuns(workflowId)
      .then((value) => {
        if (!disposed) setRuns(value.runs);
      })
      .catch(() => {
        if (!disposed) setError("历史记录读取失败，请关闭后重试。");
      });
    return () => {
      disposed = true;
      alive.current = false;
    };
  }, [client, workflowId]);
  async function inspect(id: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const value = await client.getWorkflowRun(workflowId, id);
      if (alive.current) {
        onSelect(value);
        onClose();
      }
    } catch (cause) {
      if (alive.current) {
        onDenied();
        setError(cause instanceof Error ? cause.message : "运行不可读取，可能已撤权。");
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      isDismissable={!busy}
      showCloseButton={!busy}
      className="sm:max-w-2xl"
    >
      <DialogHeader>
        <DialogTitle>调试运行历史</DialogTitle>
        <DialogDescription>
          最近 50 次 · 查看原运行结果，不会覆盖草稿或重新调用模型。外部 API 调用记录位于发布面板。
        </DialogDescription>
      </DialogHeader>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="max-h-[60dvh] space-y-2 overflow-y-auto">
        {runs === null ? (
          <p className="text-xs text-muted-foreground">读取中…</p>
        ) : runs.length === 0 ? (
          <p className="text-xs text-muted-foreground">暂无调试运行</p>
        ) : (
          runs.map((run) => (
            <div
              key={run.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-xs"
            >
              <div className="min-w-0">
                <strong>{labels[run.status]}</strong>
                <span className="ml-2">
                  {run.debugNodeId ? `单节点调试 · ${run.debugNodeId}` : "整图运行"}
                </span>
                <time className="ml-3 text-muted-foreground">
                  {new Date(run.createdAt).toLocaleString()}
                </time>
                <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                  {run.id}
                </p>
                {run.resumedFromRunId && (
                  <p className="mt-1 text-muted-foreground">
                    继续/局部重跑自 {run.resumedFromRunId.slice(0, 8)}
                  </p>
                )}
              </div>
              <button className={actionClass} disabled={busy} onClick={() => void inspect(run.id)}>
                查看此运行
              </button>
            </div>
          ))
        )}
      </div>
    </Dialog>
  );
}
