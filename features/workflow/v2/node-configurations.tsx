"use client";

import type { ReactNode } from "react";
import type { WorkflowV2Kind, WorkflowV2Node, WorkflowV2NodeData } from "./domain/nodes";
import { V2KnowledgeConfig } from "./knowledge-config";
import { HttpRequestConfig } from "./http-config";
import { V2BranchConfig } from "./branch-config";
import { TransformConfig } from "./data-task-config";
import { ModelConfig } from "./model-config";
import { LoopConfig } from "./loop-config";
import { ScriptConfig } from "./script-config";

type Slot = "before-gate" | "after-gate";
type ConfigProps<K extends WorkflowV2Kind> = {
  data: WorkflowV2NodeData<K>;
  admin: boolean;
  onChange: (data: WorkflowV2NodeData) => void;
};
type Configurations = {
  [K in WorkflowV2Kind]: { slot: Slot; render: (props: ConfigProps<K>) => ReactNode };
};

/** 每一种节点都必须声明配置视图；该映射留在展示层，领域注册表不引用 React。 */
export const NODE_CONFIGURATIONS: Configurations = {
  start: { slot: "after-gate", render: () => null },
  end: { slot: "after-gate", render: () => null },
  llm: { slot: "after-gate", render: (props) => <ModelConfig kind="llm" {...props} /> },
  knowledgeRetrieve: { slot: "before-gate", render: (props) => <V2KnowledgeConfig {...props} /> },
  knowledgeAnswer: {
    slot: "after-gate",
    render: (props) => (
      <>
        <p className="rounded-lg bg-primary/5 p-3 text-xs leading-5">
          原始问题用于回答，检索词用于找资料，两者可以不同。原始问题可连接开始节点，检索上下文连接知识检索节点。仍校验检索来源、固定版本、正文和权限；没有依据时返回固定提示，不自动转自由回答。
        </p>
        <ModelConfig kind="knowledgeAnswer" {...props} />
      </>
    ),
  },
  condition: { slot: "after-gate", render: (props) => <V2BranchConfig {...props} /> },
  merge: {
    slot: "after-gate",
    render: () => (
      <p className="rounded-lg bg-primary/5 p-3 text-xs leading-5">
        每个字段可选择多个互斥来源，仅接收已执行分支的结果。必填字段须覆盖全部分支；可选字段可省略。也可连接执行条件并设置默认文本，直接返回预设结果。
      </p>
    ),
  },
  httpRequest: { slot: "before-gate", render: (props) => <HttpRequestConfig {...props} /> },
  parameterExtract: {
    slot: "after-gate",
    render: (props) => <ModelConfig kind="parameterExtract" {...props} />,
  },
  intentClassify: {
    slot: "after-gate",
    render: (props) => <ModelConfig kind="intentClassify" {...props} />,
  },
  transform: { slot: "after-gate", render: (props) => <TransformConfig {...props} /> },
  script: { slot: "after-gate", render: (props) => <ScriptConfig {...props} /> },
  loop: { slot: "after-gate", render: (props) => <LoopConfig kind="loop" {...props} /> },
  batch: { slot: "after-gate", render: (props) => <LoopConfig kind="batch" {...props} /> },
};

function renderConfiguration<K extends WorkflowV2Kind>(kind: K, slot: Slot, props: ConfigProps<K>) {
  const config = NODE_CONFIGURATIONS[kind];
  return config.slot === slot ? config.render(props) : null;
}

export function NodeTypeConfig({
  node,
  slot,
  admin,
  onChange,
}: {
  node: WorkflowV2Node;
  slot: Slot;
  admin: boolean;
  onChange: (data: WorkflowV2NodeData) => void;
}) {
  return renderConfiguration(node.type, slot, { data: node.data, admin, onChange });
}
