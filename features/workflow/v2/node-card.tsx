"use client";

import { Handle, Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import { createContext, useContext, useEffect } from "react";
import type { WorkflowRun, WorkflowNodeRun } from "../types";
import {
  branchPorts,
  CONTROL_PORT,
  NODE_LABELS,
  nodeInputLabel,
  outputFields,
  inputFields,
  NODE_DEFINITIONS,
  isBranch,
  type WorkflowV2Node,
  type WorkflowV2Kind,
} from "./types";
import { useAiStore } from "@/features/ai/store";
import { V2OutputView } from "./output-view";
import { V2_NODE_ICONS } from "./node-icons";
import { V2RunStatus } from "./run-status";
import { reportedProgress } from "./run-presentation";
import {
  cardStyle,
  headerStyle,
  NodeCardDescription,
  NodeProgressBar,
} from "./node-card-presentation";

export const V2RunContext = createContext<WorkflowRun | null>(null);
export const V2DebugContext = createContext<WorkflowRun | null>(null);

function useNodeCardRun(id: string) {
  const normal = useContext(V2RunContext)?.nodes.find((node) => node.nodeId === id);
  const debug = useContext(V2DebugContext)?.nodes.find((node) => node.nodeId === id);
  return { run: debug ?? normal, debugging: Boolean(debug) };
}
type CardProps = { [K in WorkflowV2Kind]: NodeProps<WorkflowV2Node<K>> }[WorkflowV2Kind];
export function V2NodeCard(props: CardProps) {
  const { id, type, data, selected } = props;
  const { run, debugging } = useNodeCardRun(id);
  const update = useUpdateNodeInternals();
  const providers = useAiStore((state) => state.providers);
  const configured = providers
    .flatMap((provider) =>
      provider.models.map((model) => ({ ...model, providerName: provider.name })),
    )
    .find((model) => model.id === data.modelId);
  const signature = JSON.stringify([
    data.fields,
    data.cases,
    data.intents,
    data.outputFields,
    data.outputMode,
  ]);
  useEffect(() => {
    update(id);
  }, [signature, id, update]);
  const Icon = V2_NODE_ICONS[type];
  const running = run?.status === "running";
  const progress = reportedProgress(run?.progress);
  const inputs = inputFields({ ...props, position: { x: 0, y: 0 } });
  const outputs = outputFields({ ...props, position: { x: 0, y: 0 } });
  return (
    <section
      data-run-status={run?.status}
      aria-current={running ? "step" : undefined}
      className={cardStyle(run, selected)}
    >
      <header className={headerStyle(run?.status)}>
        <span className="text-muted-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
        <strong className="min-w-0 flex-1 truncate text-sm">
          {data.title || NODE_LABELS[type]}
        </strong>
        {debugging && <span className="text-[10px] text-primary">独立调试</span>}
        {run && <V2RunStatus status={run.status} reused={run.isReused} progress={progress} />}
      </header>
      <div className="py-3 text-xs">
        <NodeCardDescription
          type={type}
          data={data}
          model={configured}
          running={running}
          progress={progress}
        />
        {NODE_DEFINITIONS[type].acceptsControl && (
          <div className="relative mb-2 border-b px-4 pb-3 text-amber-700">
            <Handle
              type="target"
              position={Position.Left}
              id={CONTROL_PORT}
              style={{ background: "#d97706", width: 10, height: 10 }}
            />
            执行条件
          </div>
        )}
        {inputs.map((field) => (
          <div key={field.key} className="relative flex items-center justify-between px-4 py-2">
            <Handle
              type="target"
              position={Position.Left}
              id={field.key}
              style={{ background: "#7c3aed", width: 9, height: 9 }}
            />
            <span>
              {nodeInputLabel(type, field)}
              {field.required && " *"}
            </span>
            <code className="text-[10px] text-muted-foreground">{field.type}</code>
          </div>
        ))}
        {outputs.map((field) => (
          <div key={field.key} className="relative flex items-center justify-between px-4 py-2">
            <code className="text-[10px] text-muted-foreground">{field.type}</code>
            <span>{field.label || field.key}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={field.key}
              style={{ background: "#7c3aed", width: 9, height: 9 }}
            />
          </div>
        ))}
        {isBranch(type) &&
          branchPorts(data).map((port) => (
            <div
              key={port.key}
              className="relative flex items-center justify-between px-4 py-2 text-amber-700"
            >
              <code className="text-[10px]">分支</code>
              <span>{port.label}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={port.key}
                style={{ background: "#d97706", width: 10, height: 10 }}
              />
            </div>
          ))}
        <NodeRunOutput run={run} />
      </div>
      {run?.error && (
        <p className="nodrag border-t bg-destructive/5 p-3 text-xs text-destructive">{run.error}</p>
      )}
      {running && <NodeProgressBar progress={progress} />}
    </section>
  );
}
function NodeRunOutput({ run }: { run?: WorkflowNodeRun }) {
  const fields = run?.output?.fields;
  return (
    fields && (
      <div className="nodrag nowheel mx-3 mt-2 max-h-48 overflow-auto">
        <V2OutputView fields={fields} />
      </div>
    )
  );
}
