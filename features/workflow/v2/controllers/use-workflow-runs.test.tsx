import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkflowApiError } from "../../api";
import type { WorkflowRun } from "../../types";
import { controllerFixture, deferred } from "../../controllers/controller-test-helpers";
import { useWorkflowRuns } from "./use-workflow-runs";

afterEach(() => vi.useRealTimers());
describe("independent whole and node runs", () => {
  it("cannot restore a late debug read after cached results were cleared", async () => {
    const { client, run, graph } = controllerFixture();
    const restored = deferred<WorkflowRun>();
    const debug = { ...run, id: "debug", debugNodeId: graph.nodes[1].id };
    client.listWorkflowRuns.mockResolvedValue({ runs: [debug] });
    client.getWorkflowRun.mockReturnValue(restored.promise);
    const { result } = renderHook(() => useWorkflowRuns("w", run, client, true, vi.fn()));
    await act(async () => {});
    act(() => result.current.clear());
    await act(async () => restored.resolve(debug));
    expect(result.current.run).toBeNull();
    expect(result.current.debugRun).toBeNull();
  });
  it.each([401, 403, 404])(
    "clears inaccessible run state on %s without creating another task",
    async (status) => {
      vi.useFakeTimers();
      const { client, run } = controllerFixture();
      const onDenied = vi.fn();
      client.getWorkflowRun.mockRejectedValue(new WorkflowApiError("denied", status));
      const { result } = renderHook(() => useWorkflowRuns("w", run, client, true, onDenied));
      await act(() => vi.advanceTimersByTimeAsync(1500));
      expect(result.current.run).toBeNull();
      expect(onDenied).toHaveBeenCalledWith("run", expect.stringContaining("已清除"));
      expect(client.startWorkflowRun).not.toHaveBeenCalled();
    },
  );
  it("updates debug results without replacing whole-run results", async () => {
    vi.useFakeTimers();
    const { client, run, graph } = controllerFixture();
    const debug = { ...run, id: "debug", debugNodeId: graph.nodes[1].id };
    client.getWorkflowRun.mockImplementation(async (_workflowId: string, id: string) => ({
      ...(id === "debug" ? debug : run),
      status: "succeeded",
    }));
    const { result } = renderHook(() => useWorkflowRuns("w", run, client, true, vi.fn()));
    act(() => result.current.setDebugRun(debug));
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(result.current.run?.id).toBe(run.id);
    expect(result.current.debugRun?.id).toBe("debug");
    expect(result.current.debugRun?.status).toBe("succeeded");
    expect(client.startNodeDebug).not.toHaveBeenCalled();
  });
});
