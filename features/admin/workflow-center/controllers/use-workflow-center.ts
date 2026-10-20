"use client";
import { useCenterColumns } from "./use-center-columns";
import { useCenterCommands } from "./use-center-commands";
import { useCenterQuery } from "./use-center-query";
export function useWorkflowCenter(defaultView: string) {
  const query = useCenterQuery(defaultView);
  const columns = useCenterColumns();
  const commands = useCenterCommands();
  return { ...query, ...columns, ...commands };
}
export type WorkflowCenterController = ReturnType<typeof useWorkflowCenter>;
