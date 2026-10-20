import type { LucideIcon } from "lucide-react";
import type { WorkflowV2Kind } from "./domain/nodes";
import {
  BookOpen,
  Bot,
  Flag,
  GitBranch,
  Globe,
  Merge,
  MessageCircle,
  Play,
  ScanText,
  Tags,
  Braces,
  Repeat,
  Layers,
  Terminal,
} from "lucide-react";

/** 工具条与画布节点共享图标，保持节点类型的视觉识别一致。 */
export const V2_NODE_ICONS = {
  start: Play,
  llm: Bot,
  end: Flag,
  knowledgeRetrieve: BookOpen,
  knowledgeAnswer: MessageCircle,
  condition: GitBranch,
  merge: Merge,
  httpRequest: Globe,
  parameterExtract: ScanText,
  intentClassify: Tags,
  transform: Braces,
  script: Terminal,
  loop: Repeat,
  batch: Layers,
} satisfies Record<WorkflowV2Kind, LucideIcon>;
