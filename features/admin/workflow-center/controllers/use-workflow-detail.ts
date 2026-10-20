"use client";
import type { WorkflowDetailProps } from "../detail-types";
import { useDetailNavigation } from "./use-detail-navigation";
import { useDetailQuery } from "./use-detail-query";
import { useDetailState } from "./use-detail-state";
export function useWorkflowDetail(props: WorkflowDetailProps) {
  const state = useDetailState(props);
  useDetailQuery(state);
  const navigation = useDetailNavigation(state);
  return { ...state, ...navigation };
}
export type WorkflowDetailController = ReturnType<typeof useWorkflowDetail>;
