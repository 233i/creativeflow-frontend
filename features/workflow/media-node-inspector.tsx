"use client";

import type { ComponentType } from "react";
import type { NodeProps } from "@xyflow/react";
import type { WorkflowNode } from "./types";
import { MediaNodeInspectorContext } from "./nodes/node-shell";

/** 重用原媒体节点表单，不另写一套模型、时长、素材或 API 参数转换。 */
export function MediaNodeInspector({
  node,
  component: Component,
}: {
  node: WorkflowNode;
  component: ComponentType<NodeProps>;
}) {
  return (
    <MediaNodeInspectorContext.Provider value>
      <Component
        id={node.id}
        data={node.data}
        type={node.type ?? "text"}
        selected
        dragging={false}
        draggable={false}
        selectable={false}
        deletable={false}
        isConnectable={false}
        zIndex={0}
        positionAbsoluteX={node.position.x}
        positionAbsoluteY={node.position.y}
      />
    </MediaNodeInspectorContext.Provider>
  );
}
