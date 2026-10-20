"use client";

import type { NodeConfiguration } from "./domain/nodes";
import { controlClass } from "./config-styles";

export function RetryConfig({ data, onChange }: { data: NodeConfiguration; onChange: (data: NodeConfiguration) => void }) {
  const retry = data.retry ?? { maxAttempts: 1, backoffMs: 1000, maxBackoffMs: 120000, retryOn: [] };
  return (
    <details className="rounded-xl border p-3">
      <summary className="cursor-pointer text-xs font-semibold">节点失败重试</summary>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs">
          最大尝试次数
          <input aria-label="最大尝试次数" type="number" min={1} max={5} className={controlClass} value={retry.maxAttempts}
            onChange={(event) => onChange({ ...data, retry: { ...retry, maxAttempts: Number(event.target.value) } })} />
        </label>
        <label className="text-xs">
          首次退避毫秒
          <input aria-label="首次退避毫秒" type="number" min={0} max={120000} className={controlClass} value={retry.backoffMs}
            onChange={(event) => onChange({ ...data, retry: { ...retry, backoffMs: Number(event.target.value) } })} />
        </label>
        <label className="col-span-2 text-xs">
          允许重试的错误码（逗号分隔，留空表示瞬态错误）
          <input aria-label="允许重试的错误码" className={controlClass} value={(retry.retryOn ?? []).join(",")}
            onChange={(event) => onChange({ ...data, retry: { ...retry, retryOn: event.target.value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8) } })} />
        </label>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">远端可能已受理的模型、HTTP 和未知结果不会自动重发；默认一次执行。</p>
    </details>
  );
}
