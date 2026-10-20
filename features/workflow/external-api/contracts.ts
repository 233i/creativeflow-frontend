import type { WorkflowV2Graph } from "../v2/types";

/** 发布展示和示例只依赖公开字段，不读取内部节点绑定或连接配置。 */
export interface PublicationField {
  key: string;
  label?: string;
  description?: string;
  type: string;
  required?: boolean;
  default?: unknown;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  nullable?: boolean;
  integer?: boolean;
  enum?: (string | number | boolean | null)[];
  properties?: PublicationField[];
  items?: PublicationField;
  minItems?: number;
  maxItems?: number;
  constraints?: {
    maxLength?: number;
    minimum?: number;
    maximum?: number;
    values?: readonly string[];
  };
}
export interface PublicationManifest {
  schemaVersion: number;
  /** 图类型是稳定契约的一部分，不再用 schemaVersion 区分工作流。 */
  mode?: "typed" | "media";
  inputs: PublicationField[];
  outputs: PublicationField[];
}

/** 对外字段只取开始和结束节点；模型、提示词、资料 ID 不进入公开契约。 */
export function v2PublicationManifest(graph: WorkflowV2Graph): PublicationManifest {
  return {
    schemaVersion: 1,
    mode: "typed",
    inputs: graph.nodes.find((node) => node.type === "start")?.data.fields ?? [],
    outputs: graph.nodes.find((node) => node.type === "end")?.data.fields ?? [],
  };
}
