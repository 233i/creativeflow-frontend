import { type AiModel } from "@/features/ai/types";

export function modelCapabilitiesDraft(model: AiModel | null) {
  return {
    supportsVision: model?.supportsVision ?? false,
    supportsFunctionCall: model?.supportsFunctionCall ?? false,
    supportsThinking: model?.supportsThinking ?? false,
  };
}
