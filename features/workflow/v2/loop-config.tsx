"use client";

import { useState } from "react";
import { actionClass, controlClass } from "./config-styles";
import type { WorkflowV2NodeData } from "./domain/nodes";

export function LoopConfig({
  kind,
  data,
  onChange,
}: {
  kind: "loop" | "batch";
  data: WorkflowV2NodeData<"loop"> | WorkflowV2NodeData<"batch">;
  onChange: (data: WorkflowV2NodeData) => void;
}) {
  const [bodyText, setBodyText] = useState(() => JSON.stringify(data.body ?? {}, null, 2));
  const isBatch = kind === "batch";
  function update(patch: Record<string, unknown>) {
    onChange({ ...data, ...patch });
  }
  return (
    <section className="space-y-3 rounded-xl border bg-muted/20 p-3">
      <div>
        <h3 className="text-xs font-semibold">{isBatch ? "批处理配置" : "循环配置"}</h3>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          每个元素（或每个批次）执行一次子流程，结果按输入顺序返回。子流程不能包含知识库或 HTTP
          节点；外部副作用请在循环外显式编排。
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">
          最大项数
          <input
            aria-label="最大项数"
            type="number"
            min={1}
            max={100}
            className={controlClass}
            value={data.maxItems ?? 100}
            onChange={(event) => update({ maxItems: Number(event.target.value) })}
          />
        </label>
        <label className="text-xs">
          并发数
          <input
            aria-label="并发数"
            type="number"
            min={1}
            max={8}
            className={controlClass}
            value={data.parallelism ?? 1}
            onChange={(event) => update({ parallelism: Number(event.target.value) })}
          />
        </label>
        {isBatch && (
          <label className="text-xs">
            批大小
            <input
              aria-label="批大小"
              type="number"
              min={1}
              max={50}
              className={controlClass}
              value={data.batchSize ?? 10}
              onChange={(event) => update({ batchSize: Number(event.target.value) })}
            />
          </label>
        )}
        <label className="text-xs">
          单项失败策略
          <select
            aria-label="单项失败策略"
            className={controlClass}
            value={data.failurePolicy ?? (isBatch ? "continue" : "failFast")}
            onChange={(event) => update({ failurePolicy: event.target.value })}
          >
            <option value="failFast">首项失败即停止</option>
            <option value="continue">继续处理并收集错误</option>
          </select>
        </label>
      </div>
      <label className="block text-xs">
        子流程图 JSON
        <textarea
          aria-label="子流程图 JSON"
          className={`${controlClass} min-h-40 font-mono text-[11px]`}
          value={bodyText}
          onChange={(event) => {
            setBodyText(event.target.value);
            try {
              const parsed = JSON.parse(event.target.value);
              if (
                parsed &&
                parsed.schemaVersion === 1 &&
                Array.isArray(parsed.nodes) &&
                Array.isArray(parsed.edges)
              )
                update({ body: parsed });
            } catch {
              // 只在 JSON 完整时写回草稿，避免每次输入都破坏当前可执行图。
            }
          }}
          onBlur={() => {
            try {
              setBodyText(JSON.stringify(JSON.parse(bodyText), null, 2));
            } catch {
              setBodyText(JSON.stringify(data.body ?? {}, null, 2));
            }
          }}
        />
      </label>
      <button
        type="button"
        className={actionClass}
        onClick={() => {
          const retry = data.retry ?? {
            maxAttempts: 1,
            backoffMs: 1000,
            maxBackoffMs: 120000,
            retryOn: [],
          };
          update({
            retry: {
              ...retry,
              maxAttempts: Math.min(5, Math.max(1, Number(retry.maxAttempts) || 1)),
            },
          });
        }}
      >
        使用默认安全重试策略
      </button>
    </section>
  );
}
