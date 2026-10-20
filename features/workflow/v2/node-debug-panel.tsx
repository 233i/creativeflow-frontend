"use client";
import { NODE_LABELS, nodeInputLabel, usesModel } from "./types";
import { V2RunPanel } from "./run-panel";
import { FieldInput } from "./field-input";
import { V2_RUN_LABELS } from "./run-presentation";
import { useNodeDebug, type NodeDebugPanelProps } from "./controllers/use-node-debug";
export type { NodeDebugRequest } from "./controllers/use-node-debug";
const control =
  "w-full rounded-lg border bg-background px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/25";
const action = "rounded-lg border px-3 py-2 text-xs disabled:opacity-40";
export function NodeDebugPanel(props: NodeDebugPanelProps) {
  const { node, graph, run, blocked, onLocate } = props;
  const {
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
  } = useNodeDebug(props);
  return (
    <section aria-label="单节点调试" className="space-y-4 p-4">
      <header>
        <h2 className="text-sm font-semibold">调试 {node.data.title || NODE_LABELS[node.type!]}</h2>
        <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{node.id}</p>
      </header>
      <p className="rounded-lg bg-primary/5 p-3 text-xs leading-5">
        只执行此节点，忽略它的执行条件，不运行上下游；不改变整图最近结果。
        {usesModel(node.type) || node.type === "knowledgeRetrieve"
          ? "提交可能产生模型费用。"
          : ["httpRequest"].includes(node.type ?? "")
            ? "会调用已配置的真实外部操作。"
            : "此节点不会调用模型。"}
      </p>
      {node.type === "knowledgeAnswer" && (
        <p className="text-xs leading-5 text-muted-foreground">
          可使用不同于历史检索词的原始问题调试回答。检索上下文只能复用已授权的历史证据；调试不会重新检索。
        </p>
      )}
      <fieldset disabled={busy || active || blocked || !!pending} className="space-y-3">
        <label className="block text-xs">
          输入来源
          <select
            aria-label="调试输入来源"
            className={control}
            value={source}
            onChange={(event) => selectSource(event.target.value)}
          >
            <option value="">手动输入</option>
            {history
              .filter((item) => !item.debugNodeId || item.debugNodeId === node.id)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {new Date(item.createdAt).toLocaleString()} ·{" "}
                  {item.debugNodeId ? "节点调试" : "整图运行"} · {V2_RUN_LABELS[item.status]}
                </option>
              ))}
          </select>
        </label>
        {manual.map((field) => (
          <div key={field.key} className="block space-y-1 text-xs">
            <span>
              {field.label || field.key} {field.required ? "*" : "（可选）"} · {field.type}
            </span>
            <FieldInput
              field={field}
              draft={draft}
              onChange={setDraft}
              label={`调试参数 ${field.key}`}
              className={control}
            />
          </div>
        ))}
        {knowledge.map((field) => (
          <details key={field.key} className="rounded-lg border p-2 text-xs">
            <summary>{nodeInputLabel(node.type, field)} · 只读历史证据</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px]">
              {evidence[field.key]
                ? JSON.stringify(evidence[field.key], null, 2)
                : "请载入有权限的历史输入。不能手工填写证据。"}
            </pre>
          </details>
        ))}
      </fieldset>
      {error && (
        <p role="alert" className="whitespace-pre-wrap text-xs text-destructive">
          {error}
        </p>
      )}
      {pending ? (
        <div className="space-y-2 rounded-lg bg-amber-500/10 p-3 text-xs">
          <p>本次提交尚未确认。下面按钮使用相同请求 ID，只会确认原任务，不会重复执行。</p>
          <button
            className={action}
            disabled={busy || active || blocked}
            onClick={() => void start(true)}
          >
            重新确认这次提交
          </button>
        </div>
      ) : (
        <button
          className={`${action} bg-primary text-primary-foreground`}
          disabled={busy || active || blocked}
          onClick={() => void start()}
        >
          {busy ? "提交中…" : "执行此节点"}
        </button>
      )}
      {active && (
        <button
          className={`${action} ml-2`}
          disabled={busy}
          onClick={() => void readRun(run!.id, true)}
        >
          停止调试
        </button>
      )}
      {run && (
        <div className="-mx-4 border-t">
          <V2RunPanel
            run={run}
            graph={graph}
            now={clock}
            busy={busy}
            onLocate={onLocate}
            onResume={() => {}}
            onRefresh={() => void readRun(run.id)}
          />
        </div>
      )}
      <details className="border-t pt-3">
        <summary className="cursor-pointer text-xs font-medium">此节点的调试历史</summary>
        <div className="mt-2 max-h-56 space-y-2 overflow-auto">
          {history
            .filter((item) => item.debugNodeId === node.id)
            .map((item) => (
              <button
                key={item.id}
                className={`${action} block w-full text-left`}
                disabled={busy || active}
                onClick={() => void readRun(item.id)}
              >
                {new Date(item.createdAt).toLocaleString()} · {V2_RUN_LABELS[item.status]}
                <span className="mt-1 block break-all font-mono text-[10px]">{item.id}</span>
              </button>
            ))}
          {!history.some((item) => item.debugNodeId === node.id) && (
            <p className="text-xs text-muted-foreground">
              暂无记录；仅列最近 50 次工作流运行中的此节点调试。
            </p>
          )}
        </div>
      </details>
    </section>
  );
}
