import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRunCreation } from "./use-run-creation";
import { WorkflowApiError } from "../api";
import { controllerFixture, deferred } from "./controller-test-helpers";
import type { WorkflowRun } from "../types";

describe("run creation recovery", () => {
  it("propagates permission loss while resolving an ambiguous submission", async () => {
    const { client } = controllerFixture();
    client.startWorkflowRun.mockRejectedValue(new Error("lost"));
    const denied = new WorkflowApiError("denied", 403);
    client.getLatestWorkflowRun.mockRejectedValue(denied);
    const { result } = renderHook(() => useRunCreation("w", client, vi.fn()));
    await act(async () => {
      await expect(
        result.current.create("restart", "w", null, client.startWorkflowRun),
      ).rejects.toBe(denied);
    });
    expect(client.startWorkflowRun).toHaveBeenCalledTimes(1);
  });
  it("does not mistake the previous result for acceptance or submit a second command", async () => {
    const { client, run } = controllerFixture();
    const onRun = vi.fn();
    client.startWorkflowRun.mockRejectedValue(new Error("lost"));
    const { result } = renderHook(() => useRunCreation("w", client, onRun));
    await act(async () => {
      await expect(
        result.current.create("restart", "w", run.id, client.startWorkflowRun),
      ).rejects.toThrow("lost");
    });
    expect(onRun).not.toHaveBeenCalled();
    expect(result.current.uncertain?.command).toBe("restart");
    await act(async () => {
      await expect(
        result.current.create("resume", "w", run.id, client.resumeWorkflowRun),
      ).rejects.toThrow("没有重新提交");
    });
    expect(client.resumeWorkflowRun).not.toHaveBeenCalled();
    client.getLatestWorkflowRun.mockResolvedValue({ ...run, id: "accepted" });
    await act(async () => {
      await result.current.recover();
    });
    expect(onRun).toHaveBeenCalledWith(expect.objectContaining({ id: "accepted" }));
    expect(result.current.uncertain).toBeNull();
    expect(client.startWorkflowRun).toHaveBeenCalledTimes(1);
  });
  it("allows an explicit new attempt after a definite validation rejection", async () => {
    const { client } = controllerFixture();
    client.getLatestWorkflowRun.mockResolvedValue(null);
    client.startWorkflowRun.mockRejectedValue(new WorkflowApiError("invalid", 400));
    const { result } = renderHook(() => useRunCreation("w", client, vi.fn()));
    await act(async () => {
      await expect(
        result.current.create("restart", "w", null, client.startWorkflowRun),
      ).rejects.toThrow("invalid");
    });
    expect(result.current.uncertain).toBeNull();
  });
  it("does not query or publish a creation response after the editor is unmounted", async () => {
    const { client } = controllerFixture();
    const pending = deferred<WorkflowRun>();
    const onRun = vi.fn();
    const { result, unmount } = renderHook(() => useRunCreation("w", client, onRun));
    let operation: Promise<void>;
    act(() => {
      operation = result.current.create("restart", "w", null, () => pending.promise);
    });
    unmount();
    await act(async () => {
      pending.reject(new Error("lost"));
      await operation;
    });
    expect(client.getLatestWorkflowRun).not.toHaveBeenCalled();
    expect(onRun).not.toHaveBeenCalled();
  });
});
