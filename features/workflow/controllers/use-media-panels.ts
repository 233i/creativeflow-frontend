"use client";

import { useRef, useState } from "react";
import type { WorkflowRun } from "../types";

export function useMediaPanels(run: WorkflowRun | null) {
  const [publishPanelOpen, setPublishPanelOpen] = useState(false);
  const [closedRunId, setClosedRunId] = useState<string | null>(null);
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null);
  const [nodeInspectorOpen, setNodeInspectorOpen] = useState(false);
  const runButton = useRef<HTMLButtonElement>(null);
  function setInspectorOpen(open: boolean) {
    setNodeInspectorOpen(false);
    setClosedRunId(open ? null : (run?.id ?? null));
  }
  return {
    publishPanelOpen,
    setPublishPanelOpen,
    runButton,
    inspectorOpen: !!run && run.id !== closedRunId,
    setInspectorOpen,
    inspectedNodeId,
    nodeInspectorOpen,
    inspectNode: (id: string) => {
      setInspectedNodeId(id);
      setNodeInspectorOpen(true);
    },
    switchInspector: (mode: "node" | "run" | "input" | "debug") => {
      setNodeInspectorOpen(mode === "node");
      if (mode === "run") setClosedRunId(null);
    },
  };
}
