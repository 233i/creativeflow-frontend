import { act, renderHook } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAiStore } from "@/features/ai/store";
import { useCanvasStore } from "../store";
import { persistCanvas, resolveCanvas, type ResolvedCanvas } from "../sync";
import { detachImageJobs } from "../image-jobs";
import { useCanvasSession } from "./use-canvas-session";

vi.mock("../sync", () => ({
  resolveCanvas: vi.fn(),
  persistCanvas: vi.fn(),
  rememberCurrentCanvas: vi.fn(),
}));
vi.mock("../execution", () => ({ resumeVideoJobs: vi.fn() }));
vi.mock("../image-jobs", () => ({ detachImageJobs: vi.fn(), resumeImageJobs: vi.fn() }));
const saved: ResolvedCanvas = {
  id: "canvas",
  name: "Saved",
  nodes: [
    { id: "text", type: "text", position: { x: 0, y: 0 }, data: { label: "Text", text: "stored" } },
  ],
  edges: [],
  pushedLocal: false,
  savedAt: 1,
};
const advance = async (ms = 401) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  useCanvasStore.setState(useCanvasStore.getInitialState(), true);
  useAiStore.setState({ load: vi.fn(async () => {}) });
  vi.mocked(resolveCanvas).mockResolvedValue(saved);
  vi.mocked(persistCanvas).mockResolvedValue("saved");
});
afterEach(() => vi.useRealTimers());
function mount() {
  const wrapper = createRef<HTMLDivElement>();
  return renderHook(() => useCanvasSession("canvas", wrapper));
}
describe("canvas document session", () => {
  it("does not autosave an empty store while hydration is pending and ignores a late result after unmount", async () => {
    let resolve!: (value: ResolvedCanvas) => void;
    vi.mocked(resolveCanvas).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const hook = mount();
    await advance(1000);
    expect(persistCanvas).not.toHaveBeenCalled();
    hook.unmount();
    await act(async () => resolve(saved));
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
    expect(detachImageJobs).toHaveBeenCalledWith("canvas");
  });
  it("waits for all overlapping gestures before saving the final position", async () => {
    const hook = mount();
    await advance();
    vi.mocked(persistCanvas).mockClear();
    act(() => {
      useCanvasStore.getState().updateNodeData("text", { text: "edited" });
      hook.result.current.positionGesture("node", true);
      hook.result.current.positionGesture("selection", true);
      useCanvasStore
        .getState()
        .onNodesChange([
          { id: "text", type: "position", position: { x: 75, y: 30 }, dragging: true },
        ]);
    });
    await advance(800);
    expect(persistCanvas).not.toHaveBeenCalled();
    act(() => hook.result.current.positionGesture("node", false));
    await advance();
    expect(persistCanvas).not.toHaveBeenCalled();
    act(() => {
      useCanvasStore
        .getState()
        .onNodesChange([
          { id: "text", type: "position", position: { x: 150, y: 60 }, dragging: false },
        ]);
      hook.result.current.positionGesture("selection", false);
    });
    await advance();
    expect(persistCanvas).toHaveBeenCalledOnce();
    expect(vi.mocked(persistCanvas).mock.calls[0][1][0].position).toEqual({ x: 150, y: 60 });
    expect(hook.result.current.saveState).toBe("saved");
  });
  it("reports a failed save, saves the next edit and cancels queued work on unmount", async () => {
    const hook = mount();
    await advance();
    vi.mocked(persistCanvas).mockResolvedValueOnce("error");
    act(() => useCanvasStore.getState().updateNodeData("text", { text: "offline" }));
    await advance();
    expect(hook.result.current.saveState).toBe("error");
    act(() => useCanvasStore.getState().updateNodeData("text", { text: "recovered" }));
    await advance();
    expect(hook.result.current.saveState).toBe("saved");
    vi.mocked(persistCanvas).mockClear();
    act(() => useCanvasStore.getState().updateNodeData("text", { text: "pending" }));
    hook.unmount();
    await advance();
    expect(persistCanvas).not.toHaveBeenCalled();
  });
});
