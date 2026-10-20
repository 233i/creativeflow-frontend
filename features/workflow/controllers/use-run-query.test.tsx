import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRunQuery } from "./use-run-query";
import { controllerFixture, deferred } from "./controller-test-helpers";
import type { WorkflowRun } from "../types";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("run query lifecycle", () => {
  it("does not reuse an old refresh callback after selecting a new run", async () => {
    const { client } = controllerFixture();
    const { result, rerender } = renderHook(
      ({ runId }) =>
        useRunQuery({
          client,
          workflowId: "w",
          runId,
          interval: null,
          onResult: vi.fn(),
          onError: vi.fn(),
        }),
      { initialProps: { runId: "old" } },
    );
    const oldRefresh = result.current.refreshAfterMutation;
    rerender({ runId: "new" });
    await act(async () => {
      await oldRefresh();
    });
    expect(client.getWorkflowRun).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.refresh();
    });
    expect(client.getWorkflowRun).toHaveBeenCalledExactlyOnceWith("w", "new");
  });
  it("coalesces polling and manual refresh without overlapping requests", async () => {
    const { client, run } = controllerFixture();
    const pending = deferred<WorkflowRun>();
    client.getWorkflowRun.mockReturnValue(pending.promise);
    const onResult = vi.fn();
    const { result } = renderHook(() =>
      useRunQuery({
        client,
        workflowId: "w",
        runId: "run",
        interval: 1500,
        onResult,
        onError: vi.fn(),
      }),
    );
    act(() => {
      void result.current.refresh();
      void result.current.refresh();
    });
    await act(() => vi.advanceTimersByTimeAsync(4500));
    expect(client.getWorkflowRun).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(run));
    expect(onResult).toHaveBeenCalledExactlyOnceWith(run);
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(client.getWorkflowRun).toHaveBeenCalledTimes(2);
  });
  it.each(["run", "document"])(
    "ignores a late response after changing %s and after unmount",
    async (kind) => {
      const { client, run } = controllerFixture();
      const old = deferred<WorkflowRun>();
      const next = deferred<WorkflowRun>();
      client.getWorkflowRun.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
      const onResult = vi.fn();
      const onError = vi.fn();
      const { result, rerender, unmount } = renderHook(
        ({ workflowId, runId }) =>
          useRunQuery({ client, workflowId, runId, interval: null, onResult, onError }),
        { initialProps: { workflowId: "one", runId: "old" } },
      );
      act(() => {
        void result.current.refresh();
      });
      rerender({
        workflowId: kind === "document" ? "two" : "one",
        runId: kind === "run" ? "new" : "old",
      });
      act(() => {
        void result.current.refresh();
      });
      await act(async () => old.resolve(run));
      expect(onResult).not.toHaveBeenCalled();
      unmount();
      await act(async () => next.reject(new Error("late")));
      expect(onError).not.toHaveBeenCalled();
    },
  );
  it("pauses hidden polling and retries on visibility without invoking commands", async () => {
    const { client } = controllerFixture();
    const onError = vi.fn();
    const onResult = vi.fn();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    client.getWorkflowRun.mockRejectedValueOnce(new Error("offline"));
    renderHook(() =>
      useRunQuery({ client, workflowId: "w", runId: "run", interval: 1500, onError, onResult }),
    );
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(client.getWorkflowRun).not.toHaveBeenCalled();
    visibility.mockReturnValue("visible");
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(onError).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(client.startWorkflowRun).not.toHaveBeenCalled();
    expect(client.resumeWorkflowRun).not.toHaveBeenCalled();
  });
  it("invalidates polling when an explicit command replaces the same run", async () => {
    const { client, run } = controllerFixture();
    const pending = deferred<WorkflowRun>();
    client.getWorkflowRun.mockReturnValue(pending.promise);
    const onResult = vi.fn();
    const { result } = renderHook(() =>
      useRunQuery({
        client,
        workflowId: "w",
        runId: "run",
        interval: null,
        onResult,
        onError: vi.fn(),
      }),
    );
    act(() => {
      void result.current.refresh();
      result.current.invalidate();
    });
    await act(async () => pending.resolve(run));
    expect(onResult).not.toHaveBeenCalled();
  });
});
