import {
  WorkflowImageGenerateNode,
  WorkflowImageNode,
  WorkflowImageOutputNode,
  WorkflowOutputNode,
  WorkflowTextNode,
  WorkflowVideoExtendNode,
  WorkflowVideoGenerateNode,
  WorkflowVideoFrameNode,
  WorkflowVideoOutputNode,
} from "@/features/workflow/nodes/workflow-nodes";
export const NODE_TYPES = {
  start: WorkflowTextNode,
  llm: WorkflowTextNode,
  knowledgeRetrieve: WorkflowTextNode,
  knowledgeAnswer: WorkflowTextNode,
  condition: WorkflowTextNode,
  merge: WorkflowTextNode,
  httpRequest: WorkflowTextNode,
  end: WorkflowOutputNode,
  parameterExtract: WorkflowTextNode,
  intentClassify: WorkflowTextNode,
  transform: WorkflowTextNode,
  text: WorkflowTextNode,
  image: WorkflowImageNode,
  imageGenerate: WorkflowImageGenerateNode,
  videoGenerate: WorkflowVideoGenerateNode,
  videoExtend: WorkflowVideoExtendNode,
  videoFrame: WorkflowVideoFrameNode,
  imageOutput: WorkflowImageOutputNode,
  videoOutput: WorkflowVideoOutputNode,
  output: WorkflowOutputNode,
};

export const PRO_OPTIONS = { hideAttribution: true };
export const FIT_VIEW_OPTIONS = { minZoom: 0.25, maxZoom: 1, padding: 0.18 };
export const DELETE_KEYS = ["Backspace", "Delete"];
