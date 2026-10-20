import { describe, expect, it } from "vitest";
import {
  getPartialRerunEdgeVisualState,
  getPartialRerunNodeVisualState,
} from "@/features/workflow/partial-rerun-preview";
import type { WorkflowEdge, WorkflowPartialRerunPreview } from "@/features/workflow/types";

const sourceNodeIds = new Set(["prompt", "generate", "output", "other"]);
const preview: WorkflowPartialRerunPreview = {
  sourceRunId: "run-1",
  fromNodeId: "generate",
  reusedNodeIds: ["prompt", "other"],
  rerunNodeIds: ["generate", "output"],
};

describe("partial rerun canvas visuals", () => {
  it("distinguishes the start, downstream, reused, and unavailable nodes", () => {
    expect(getPartialRerunNodeVisualState("generate", sourceNodeIds, preview)).toBe("start");
    expect(getPartialRerunNodeVisualState("output", sourceNodeIds, preview)).toBe("rerun");
    expect(getPartialRerunNodeVisualState("prompt", sourceNodeIds, preview)).toBe("reuse");
    expect(getPartialRerunNodeVisualState("new-node", sourceNodeIds, preview)).toBe("unavailable");
  });

  it("marks incoming and downstream rerun edges without affecting reused branches", () => {
    expect(edgeState("prompt", "generate")).toBe("rerun");
    expect(edgeState("generate", "output")).toBe("rerun");
    expect(edgeState("prompt", "other")).toBe("reuse");
    expect(edgeState("new-node", "output")).toBe("unavailable");
  });

  it("shows successful-run nodes as selectable before a start node is chosen", () => {
    expect(getPartialRerunNodeVisualState("prompt", sourceNodeIds, null)).toBe("candidate");
    expect(getPartialRerunNodeVisualState("new-node", sourceNodeIds, null)).toBe("unavailable");
  });
});

function edgeState(source: string, target: string) {
  const edge: WorkflowEdge = { id: `${source}-${target}`, source, target };
  return getPartialRerunEdgeVisualState(edge, sourceNodeIds, preview);
}
