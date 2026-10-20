"use client";

import { useState } from "react";
import { ReadonlyWorkflowGraph, snapshotNodeName } from "@/features/workflow/readonly-graph";
import { V2Inspector } from "@/features/workflow/v2/inspector";
import type { WorkflowGraph } from "@/features/workflow/types";

/** 已上架历史模板只读，不创建调试副本，不挂载任何可能写入画布的参数组件。 */
export function ReadonlyTemplate({ graph }: { graph: WorkflowGraph }) {
  const [selectedId, setSelectedId] = useState<string>();
  const [open, setOpen] = useState(false);
  const node = graph.nodes.find((value) => value.id === selectedId);
  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1">
        <ReadonlyWorkflowGraph
          graph={graph}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setOpen(true);
          }}
        />
      </div>
      {open && node && (
        <V2Inspector
          mode="node"
          hasNode
          hasRun={false}
          onMode={() => {}}
          onClose={() => setOpen(false)}
        >
          <section className="space-y-4 p-4 text-sm">
            <h2 className="font-semibold">{snapshotNodeName(node)} · 只读</h2>
            <p className="text-muted-foreground">
              当前上架版本。修改需先下架编辑，或明确复制为独立草稿。
            </p>
            <p className="break-all font-mono">{node.id}</p>
            <h3 className="font-medium">节点参数</h3>
            {Object.keys(node.data).length ? (
              <dl className="space-y-3">
                {Object.entries(node.data).map(([key, value]) => (
                  <div key={key} className="border-b pb-3">
                    <dt className="mb-1 text-muted-foreground">{key}</dt>
                    <dd className="whitespace-pre-wrap break-words">
                      {typeof value === "string" ? value || "—" : JSON.stringify(value, null, 2)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-muted-foreground">此节点没有额外参数。</p>
            )}
          </section>
        </V2Inspector>
      )}
    </div>
  );
}
