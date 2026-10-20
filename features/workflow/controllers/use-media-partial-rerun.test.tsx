import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { WorkflowApiError } from "../api";
import { useMediaPartialRerun } from "./use-media-partial-rerun";
import { controllerFixture, deferred } from "./controller-test-helpers";
import { createStarterWorkflow } from "../template";
import { useWorkflowStore } from "../store";
import type { WorkflowPartialRerunPreview } from "../types";

beforeEach(() => useWorkflowStore.getState().reset());
function setup() {
  const fixture = controllerFixture(createStarterWorkflow());
  fixture.run.status = "succeeded";
  useWorkflowStore.getState().load(fixture.graph);
  useWorkflowStore.getState().setRun(fixture.run);
  const view = renderHook(() => useMediaPartialRerun("w", fixture.client, fixture.run));
  return { ...fixture, ...view };
}
describe("media rerun selection", () => {
  it("reads the original snapshot without replacing a changed draft", async () => {
    const { client, graph, result, run } = setup();
    useWorkflowStore.getState().updateNodeData(graph.nodes[0].id, { text: "unsaved draft" });
    await act(async () => {
      await result.current.begin();
    });
    expect(client.getWorkflowRunSnapshot).toHaveBeenCalledWith("w", run.id);
    expect(result.current.selection?.graph).toEqual(graph);
    expect(useWorkflowStore.getState().nodes[0].data.text).toBe("unsaved draft");
    expect(client.saveWorkflow).not.toHaveBeenCalled();
    expect(client.partialRerunWorkflow).not.toHaveBeenCalled();
  });
  it("keeps the newest chosen node when preview responses arrive out of order", async () => {
    const { client, graph, result, run } = setup();
    await act(async () => {
      await result.current.begin();
    });
    const first = deferred<WorkflowPartialRerunPreview>();
    const next = deferred<WorkflowPartialRerunPreview>();
    client.previewPartialWorkflowRerun
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(next.promise);
    act(() => {
      void result.current.choose(graph.nodes[0].id);
    });
    act(() => {
      void result.current.choose(graph.nodes[1].id);
    });
    const newer = {
      sourceRunId: run.id,
      fromNodeId: graph.nodes[1].id,
      rerunNodeIds: [graph.nodes[1].id],
      reusedNodeIds: [],
    };
    await act(async () => next.resolve(newer));
    await act(async () => first.resolve({ ...newer, fromNodeId: graph.nodes[0].id }));
    expect(result.current.selection?.preview).toEqual(newer);
    act(() => result.current.clear());
    expect(result.current.selection).toBeNull();
  });
  it.each([401, 403, 404])(
    "clears snapshots and cached results on permission status %s",
    async (status) => {
      const { client, result } = setup();
      client.getWorkflowRunSnapshot.mockRejectedValue(new WorkflowApiError("denied", status));
      await act(async () => {
        await result.current.begin();
      });
      expect(result.current.selection).toBeNull();
      expect(useWorkflowStore.getState().run).toBeNull();
    },
  );
});
