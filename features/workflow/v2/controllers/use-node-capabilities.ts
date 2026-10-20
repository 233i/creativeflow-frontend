"use client";

import { useEffect, useState } from "react";
import type { WorkflowClient } from "../../api";
import type { WorkflowV2Kind } from "../types";

export function useNodeCapabilities(client: WorkflowClient) {
  const [available, setAvailable] = useState<WorkflowV2Kind[]>(["start", "llm", "end"]);
  useEffect(() => {
    let disposed = false;
    void client
      .getWorkflowCapabilities()
      .then((value) => {
        if (disposed) return;
        setAvailable([
          "start",
          "llm",
          ...(
            ["parameterExtract", "intentClassify", "transform", "script", "loop", "batch"] as const
          ).filter((kind) => value.nodeTypes.includes(kind)),
          ...(value.nodeTypes.includes("knowledgeRetrieve")
            ? (["knowledgeRetrieve", "knowledgeAnswer"] as const)
            : []),
          ...(value.nodeTypes.includes("condition") ? (["condition", "merge"] as const) : []),
          ...(value.nodeTypes.includes("httpRequest") ? (["httpRequest"] as const) : []),
          "end",
        ]);
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, [client]);
  return available;
}
