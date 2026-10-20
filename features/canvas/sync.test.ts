import { beforeEach, describe, expect, it, vi } from "vitest";
// 仅用于类型：运行时绑定来自下方模拟的动态导入，后者不能作为类型命名空间使用。
import type { CanvasDocument } from "@/features/canvas/api";
import type { CanvasNode } from "@/features/canvas/store";
import type { NodeKind } from "@/features/canvas/types";

// 在导入待测模块前完成模拟，使 `sync` 绑定到这些实现。
vi.mock("@/features/canvas/api", () => ({
  CanvasApiError: class CanvasApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
    }
    get isUnauthorized() {
      return this.status === 401;
    }
    get isNotFound() {
      return this.status === 404;
    }
  },
  getCanvas: vi.fn(),
  saveCanvas: vi.fn(),
  createCanvas: vi.fn(),
  listCanvases: vi.fn(),
  deleteCanvas: vi.fn(),
  renameCanvas: vi.fn(),
}));

const api = await import("@/features/canvas/api");
const { persistCanvas, resolveCanvas } = await import("@/features/canvas/sync");
const { saveLocal } = await import("@/features/canvas/persistence");

function node(id: string, type: NodeKind = "text"): CanvasNode {
  return { id, type, position: { x: 0, y: 0 }, data: {} } as CanvasNode;
}

function remoteDoc(nodes: CanvasNode[], updatedAt: string): CanvasDocument {
  return {
    id: "c1",
    name: "remote name",
    graph: { nodes, edges: [] },
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("resolveCanvas", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("takes the server copy when it is newer", async () => {
    saveLocal("c1", [node("local")], []);
    vi.mocked(api.getCanvas).mockResolvedValue(
      remoteDoc([node("remote-a"), node("remote-b")], new Date(Date.now() + 60_000).toISOString()),
    );

    const result = await resolveCanvas("c1");

    expect(result.nodes.map((n) => n.id)).toEqual(["remote-a", "remote-b"]);
    expect(result.pushedLocal).toBe(false);
    expect(api.saveCanvas).not.toHaveBeenCalled();
  });

  it("pushes the local copy when it is newer, instead of being overwritten by a stale server copy", async () => {
    // 离线编辑场景：若丢失此副本，会悄然丢弃用户最近的工作。
    vi.mocked(api.getCanvas).mockResolvedValue(
      remoteDoc([node("stale")], new Date(Date.now() - 60_000).toISOString()),
    );
    saveLocal("c1", [node("fresh-local")], []);

    const result = await resolveCanvas("c1");

    expect(result.nodes.map((n) => n.id)).toEqual(["fresh-local"]);
    expect(result.pushedLocal).toBe(true);
    expect(api.saveCanvas).toHaveBeenCalledOnce();
  });

  it("falls back to the local copy when the server is unreachable", async () => {
    // 短暂网络故障不能导致已有画布无法打开。
    saveLocal("c1", [node("offline")], []);
    vi.mocked(api.getCanvas).mockRejectedValue(new api.CanvasApiError("network", 0));

    const result = await resolveCanvas("c1");

    expect(result.nodes.map((n) => n.id)).toEqual(["offline"]);
    expect(result.pushedLocal).toBe(false);
  });

  it("returns an empty canvas when neither copy exists", async () => {
    vi.mocked(api.getCanvas).mockRejectedValue(new api.CanvasApiError("missing", 404));

    const result = await resolveCanvas("c1");

    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("tolerates a graph with no nodes/edges arrays", async () => {
    // 回归测试：新建画布存储 `{}`，它是真值，但其中的数组为 undefined；
    // 将其放入状态仓库会在下次渲染时报错 "nodes is not iterable"。
    vi.mocked(api.getCanvas).mockResolvedValue({
      id: "c1",
      name: "new",
      graph: {} as never,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await resolveCanvas("c1");

    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("tolerates a null graph", async () => {
    vi.mocked(api.getCanvas).mockResolvedValue({
      id: "c1",
      name: "new",
      graph: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await resolveCanvas("c1");

    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("caches the server copy locally so the next load paints instantly", async () => {
    vi.mocked(api.getCanvas).mockResolvedValue(
      remoteDoc([node("from-server")], new Date().toISOString()),
    );

    await resolveCanvas("c1");

    const cached = JSON.parse(window.localStorage.getItem("sol.canvas.c1")!);
    expect(cached.nodes.map((n: CanvasNode) => n.id)).toEqual(["from-server"]);
  });
});

describe("persistCanvas", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("writes locally even when the server write fails", async () => {
    // 在下次保存前暂时失去服务端持久性，但用户的编辑不会丢失。
    vi.mocked(api.saveCanvas).mockRejectedValue(new api.CanvasApiError("boom", 500));

    const state = await persistCanvas("c1", [node("a")], []);

    expect(state).toBe("error");
    expect(window.localStorage.getItem("sol.canvas.c1")).toContain('"a"');
  });

  it("strips ephemeral URLs before sending to the server", async () => {
    vi.mocked(api.saveCanvas).mockResolvedValue(remoteDoc([], new Date().toISOString()));

    const dead = {
      id: "img",
      type: "image",
      position: { x: 0, y: 0 },
      data: { assetUrl: "blob:http://localhost/dead" },
    } as CanvasNode;

    await persistCanvas("c1", [dead], []);

    const sent = vi.mocked(api.saveCanvas).mock.calls[0][1];
    expect((sent.nodes[0].data as { assetUrl?: string }).assetUrl).toBeUndefined();
  });
});
