import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useNodeDebug } from "./use-node-debug";
import { createWorkflowNode } from "../domain/node-definitions";
import { controllerFixture } from "../../controllers/controller-test-helpers";
import type { WorkflowV2Graph } from "../types";

describe("node debug request ownership", () => {
  it("reconfirms the retained knowledge source after closing and reopening the drawer", async () => {
    const { client, graph, run } = controllerFixture();
    const node = createWorkflowNode("knowledgeAnswer", "answer", { x: 0, y: 0 });
    const request = {
      requestId: "retained-request",
      inputs: { question: "retained question" },
      sourceRunId: "historical-evidence",
    };
    const onSubmit = vi.fn().mockResolvedValue({ ...run, debugNodeId: node.id });
    const { result } = renderHook(() =>
      useNodeDebug({
        workflowId: "w",
        node,
        graph: graph as WorkflowV2Graph,
        client,
        run: null,
        blocked: false,
        onRun: vi.fn(),
        onSubmit,
        onLocate: vi.fn(),
        pendingRequest: request,
        onPending: vi.fn(),
      }),
    );
    await act(async () => {
      await result.current.start(true);
    });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(request);
    expect(client.getNodeDebugInputs).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });
});
