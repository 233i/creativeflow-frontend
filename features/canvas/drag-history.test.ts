import { beforeEach, describe, expect, it } from "vitest";
import { useCanvasStore } from "./store";

beforeEach(() => useCanvasStore.getState().reset());

describe("canvas drag undo history", () => {
  it("restores the position before the first live frame and redoes the released position", () => {
    const state = useCanvasStore.getState();
    const id = state.addNode("text", { x: 10, y: 20 });
    const count = useCanvasStore.getState().past.length;
    state.onNodesChange([{ id, type: "position", position: { x: 50, y: 60 }, dragging: true }]);
    state.onNodesChange([{ id, type: "position", position: { x: 90, y: 100 }, dragging: true }]);
    state.onNodesChange([{ id, type: "position", position: { x: 90, y: 100 }, dragging: false }]);
    expect(useCanvasStore.getState().past).toHaveLength(count + 1);
    state.undo();
    expect(useCanvasStore.getState().nodes[0].position).toEqual({ x: 10, y: 20 });
    expect(useCanvasStore.getState().nodes[0].dragging).not.toBe(true);
    state.redo();
    expect(useCanvasStore.getState().nodes[0].position).toEqual({ x: 90, y: 100 });
    expect(useCanvasStore.getState().nodes[0].dragging).toBe(false);
  });

  it("keeps a multi-node gesture in one undo step when the releases arrive separately", () => {
    const state = useCanvasStore.getState();
    const first = state.addNode("text", { x: 0, y: 0 });
    const second = state.addNode("text", { x: 300, y: 0 });
    const count = useCanvasStore.getState().past.length;
    state.onNodesChange([
      { id: first, type: "position", position: { x: 40, y: 30 }, dragging: true },
      { id: second, type: "position", position: { x: 340, y: 30 }, dragging: true },
    ]);
    state.onNodesChange([
      { id: first, type: "position", position: { x: 60, y: 50 }, dragging: false },
    ]);
    state.onNodesChange([
      { id: second, type: "position", position: { x: 360, y: 50 }, dragging: false },
    ]);
    expect(useCanvasStore.getState().past).toHaveLength(count + 1);
    state.undo();
    expect(useCanvasStore.getState().nodes.map((node) => node.position)).toEqual([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ]);
    state.redo();
    expect(useCanvasStore.getState().nodes.map((node) => node.position)).toEqual([
      { x: 60, y: 50 },
      { x: 360, y: 50 },
    ]);
  });

  it("starts a fresh gesture after changing documents during a drag", () => {
    const state = useCanvasStore.getState();
    const old = state.addNode("text", { x: 0, y: 0 });
    state.onNodesChange([
      { id: old, type: "position", position: { x: 40, y: 30 }, dragging: true },
    ]);
    state.load({
      nodes: [{ id: "new", type: "text", position: { x: 5, y: 6 }, data: {} }],
      edges: [],
    });
    state.onNodesChange([
      { id: "new", type: "position", position: { x: 50, y: 60 }, dragging: true },
    ]);
    state.onNodesChange([
      { id: "new", type: "position", position: { x: 50, y: 60 }, dragging: false },
    ]);
    state.undo();
    expect(useCanvasStore.getState().nodes[0].position).toEqual({ x: 5, y: 6 });
  });
});
