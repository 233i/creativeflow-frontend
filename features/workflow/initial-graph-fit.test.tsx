import { act, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InitialGraphFit } from "./initial-graph-fit";

const state = vi.hoisted(() => ({ ready: false, fitView: vi.fn() }));
vi.mock("@xyflow/react", () => ({
  useNodesInitialized: () => state.ready,
  useReactFlow: () => ({ fitView: state.fitView }),
}));
afterEach(() => {
  vi.useRealTimers();
  state.ready = false;
  vi.clearAllMocks();
});
it("waits for all nodes and does not reset the user's viewport on later updates", async () => {
  vi.useFakeTimers();
  const view = render(<InitialGraphFit />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(state.fitView).not.toHaveBeenCalled();
  state.ready = true;
  view.rerender(<InitialGraphFit />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(state.fitView).toHaveBeenCalledExactlyOnceWith({ padding: 0.2, maxZoom: 1 });
  state.ready = false;
  view.rerender(<InitialGraphFit />);
  state.ready = true;
  view.rerender(<InitialGraphFit />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(state.fitView).toHaveBeenCalledTimes(1);
});
