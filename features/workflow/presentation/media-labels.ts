import type { useT } from "@/components/providers/i18n-provider";
import type { WorkflowNode, WorkflowNodeKind } from "../types";
import type { WorkflowValidationCode } from "../validation";
/** 将图校验错误映射到当前语言的提示。 */
export function validationMessage(
  t: ReturnType<typeof useT>,
  code: WorkflowValidationCode,
): string {
  const keys = {
    empty: "workflow.validation.empty",
    tooManyNodes: "workflow.validation.tooManyNodes",
    missingOutput: "workflow.validation.missingOutput",
    cycle: "workflow.validation.cycle",
    invalidConnection: "workflow.validation.invalidConnection",
    missingInput: "workflow.validation.missingInput",
    emptyText: "workflow.validation.emptyText",
    missingImage: "workflow.validation.missingImage",
    missingVideoExtensionModel: "workflow.validation.missingVideoExtensionModel",
    tooManyVideoFrames: "workflow.validation.tooManyVideoFrames",
  } as const;
  return t(keys[code]);
}

export function workflowNodeLabel(
  t: ReturnType<typeof useT>,
  node: Pick<WorkflowNode, "type">,
): string {
  const labels = {
    start: "workflow.nodeText",
    llm: "workflow.nodeText",
    knowledgeRetrieve: "workflow.nodeText",
    knowledgeAnswer: "workflow.nodeText",
    condition: "workflow.nodeText",
    merge: "workflow.nodeText",
    httpRequest: "workflow.nodeHttpRequest",
    end: "workflow.nodeOutput",
    parameterExtract: "workflow.nodeText",
    intentClassify: "workflow.nodeText",
    transform: "workflow.nodeText",
    text: "workflow.nodeText",
    image: "workflow.nodeImage",
    imageGenerate: "workflow.nodeImageGenerate",
    videoGenerate: "workflow.nodeVideoGenerate",
    videoExtend: "workflow.nodeVideoExtend",
    videoFrame: "workflow.nodeVideoFrame",
    imageOutput: "workflow.nodeImageOutput",
    videoOutput: "workflow.nodeVideoOutput",
    output: "workflow.nodeOutput",
  } as const;
  return t(labels[(node.type ?? "text") as WorkflowNodeKind]);
}
