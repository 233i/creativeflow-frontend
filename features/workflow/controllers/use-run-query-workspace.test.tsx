import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { WorkspacePageContext, type WorkspacePage } from "@/components/providers/workspace-context";
import { controllerFixture } from "./controller-test-helpers";
import { useRunQuery } from "./use-run-query";

afterEach(() => vi.useRealTimers());

describe("workspace background run monitoring", () => {
  it("slows running pages, pauses idle pages, and refreshes on return without submitting another run", async () => {
    vi.useFakeTimers();
    const { client } = controllerFixture();
    let active = true;
    const page: WorkspacePage = {
      key: "workflow:one",
      href: "/admin/workflows/one/edit",
      active,
      navigate: vi.fn(),
      updateLocation: vi.fn(),
      updateMeta: vi.fn(),
      registerGuard: () => () => {},
    };
    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(WorkspacePageContext.Provider, { value: { ...page, active } }, children);
    }
    const { rerender } = renderHook(
      ({ running }) =>
        useRunQuery({
          client,
          workflowId: "one",
          runId: "run",
          interval: 1500,
          backgroundRunning: running,
          onResult: vi.fn(),
          onError: vi.fn(),
        }),
      { initialProps: { running: true }, wrapper: Wrapper },
    );
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(client.getWorkflowRun).toHaveBeenCalledTimes(1);
    active = false;
    rerender({ running: true });
    await act(() => vi.advanceTimersByTimeAsync(14000));
    expect(client.getWorkflowRun).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(client.getWorkflowRun).toHaveBeenCalledTimes(2);
    rerender({ running: false });
    await act(() => vi.advanceTimersByTimeAsync(30000));
    expect(client.getWorkflowRun).toHaveBeenCalledTimes(2);
    active = true;
    rerender({ running: false });
    await act(async () => {});
    expect(client.getWorkflowRun).toHaveBeenCalledTimes(3);
    expect(client.startWorkflowRun).not.toHaveBeenCalled();
    expect(client.resumeWorkflowRun).not.toHaveBeenCalled();
  });
});
