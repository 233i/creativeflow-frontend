import { WorkflowApiError } from "../api";

export function accessDenied(reason: unknown) {
  return reason instanceof WorkflowApiError && [401, 403, 404].includes(reason.status);
}

export function submissionUncertain(reason: unknown) {
  return !(reason instanceof WorkflowApiError) || reason.status >= 500;
}

export function errorMessage(reason: unknown, fallback = "操作未完成") {
  return reason instanceof Error ? reason.message : fallback;
}

export function submissionRejected(reason: unknown) {
  return reason instanceof WorkflowApiError && reason.status >= 400 && reason.status < 500;
}
