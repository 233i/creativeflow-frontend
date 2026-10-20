import { AiApiError } from "@/features/ai/api";

/** 优先展示后端已脱敏的错误详情，不只展示机器错误码。 */
export function message(error: unknown): string {
  return error instanceof AiApiError && error.details.length
    ? error.details.join(" ")
    : error instanceof Error
      ? error.message
      : "Embedding request failed.";
}
