"use client";

import { useEffect, useState } from "react";
import type { WorkflowRun } from "../types";
import { V2RunNodes } from "../v2/run-nodes";
import { getExternalRun } from "./api";

/** 只重新查询，绝不自动提交；窗口打开期间复验访问权，撤权后清除已显示正文。 */
export function ExternalRunDetails({
  workflowId,
  runId,
  onClose,
}: {
  workflowId: string;
  runId: string;
  onClose: () => void;
}) {
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let disposed = false;
    let pending = false;
    let denied = false;
    async function read() {
      if (pending || denied) return;
      pending = true;
      try {
        const value = await getExternalRun(workflowId, runId);
        if (!disposed) {
          setRun(value);
          setError(null);
        }
      } catch (cause) {
        if (!disposed) {
          setRun(null);
          setError(cause instanceof Error ? cause.message : "暂时无法查询，请重试。");
        }
        denied =
          typeof cause === "object" &&
          cause !== null &&
          "status" in cause &&
          [401, 403, 404].includes(Number(cause.status));
      } finally {
        pending = false;
      }
    }
    void read();
    const timer = window.setInterval(() => void read(), 2500);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [workflowId, runId, retry]);
  return (
    <section aria-label="外部运行详情" className="mt-4 rounded-xl border bg-muted/10 p-4 text-xs">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">节点执行详情</h3>
          <code className="mt-1 block break-all text-[10px] text-muted-foreground">{runId}</code>
        </div>
        <button className="text-primary" onClick={onClose}>
          关闭详情
        </button>
      </header>
      <p className="mb-3 text-muted-foreground">
        查询不会重新调用模型或外部接口。查看时仍复验原 Key 和资源授权。
      </p>
      {error ? (
        <div role="alert" className="mb-3 text-destructive">
          {error}
          <button
            className="ml-3 text-primary underline"
            onClick={() => setRetry((value) => value + 1)}
          >
            重新查询
          </button>
        </div>
      ) : (
        !run && <p>读取中…</p>
      )}
      {run && (
        <>
          <p className="mb-3">状态：{run.status}</p>
          {run.error && <p className="mb-3 break-words text-destructive">{run.error}</p>}
          <V2RunNodes run={run} />
        </>
      )}
    </section>
  );
}
