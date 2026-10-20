"use client";

import { NODE_DRAG_MIME } from "./placement";
import { NODE_LABELS, NODE_DEFINITIONS, type WorkflowV2Kind } from "./types";
import { V2_NODE_ICONS } from "./node-icons";
import { WorkflowNodeLibrary } from "../node-library";

/** 与自由画布一致的悬浮工具条；点击和拖放仍走同一节点创建入口。 */
export function V2NodeLibrary({
  kinds,
  busy,
  nodeCount,
  onAdd,
}: {
  kinds: WorkflowV2Kind[];
  busy: boolean;
  nodeCount: number;
  onAdd: (kind: WorkflowV2Kind) => void;
}) {
  return (
    <WorkflowNodeLibrary
      mime={NODE_DRAG_MIME}
      onAdd={onAdd}
      items={kinds.map((kind) => ({
        kind,
        label: NODE_LABELS[kind],
        icon: V2_NODE_ICONS[kind],
        disabled: busy || (!NODE_DEFINITIONS[kind].singleton && nodeCount >= 40),
        group: NODE_DEFINITIONS[kind].group,
      }))}
    />
  );
}
