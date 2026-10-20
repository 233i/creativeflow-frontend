import { describe, expect, it } from "vitest";
import { exportCanvas, importCanvas, stripForStorage } from "@/features/canvas/persistence";
import type { CanvasEdge, CanvasNode } from "@/features/canvas/store";
import type { NodeKind } from "@/features/canvas/types";

function node(id: string, type: NodeKind, data: Record<string, unknown> = {}): CanvasNode {
  return { id, type, position: { x: 10, y: 20 }, data } as CanvasNode;
}

describe("stripForStorage", () => {
  it("keeps a submitted image task and its unresolved idempotency key recoverable", () => {
    const [result] = stripForStorage([
      node("image-job", "image", {
        imageJob: { key: "original-key", input: { prompt: "tree" }, index: 0 },
        execution: { runId: "original-key", status: "queued", phase: "submitting" },
      }),
    ]);
    expect(result.data).toMatchObject({
      imageJob: { key: "original-key" },
      execution: { status: "queued", phase: "submitting" },
    });
  });
  it("drops inline data URLs but keeps server asset URLs", () => {
    // 核心目的：若此处保留 data URL，每次保存都会写入数兆字节数据。
    const nodes = [
      node("a", "image", { assetUrl: "data:image/png;base64,AAAA", prompt: "keep me" }),
      node("b", "image", { assetUrl: "/api/v1/canvas/assets/123" }),
    ];

    const [inline, hosted] = stripForStorage(nodes);

    expect((inline.data as { assetUrl?: string }).assetUrl).toBeUndefined();
    expect((inline.data as { prompt?: string }).prompt).toBe("keep me");
    expect((hosted.data as { assetUrl?: string }).assetUrl).toBe("/api/v1/canvas/assets/123");
  });

  it("drops blob URLs, which die with the document", () => {
    // 回归测试：若只匹配 `data:`，上传图片的对象 URL 会被持久化，恢复时却已成为失效链接，
    // 导致节点显示损坏图片且无法重新上传。
    const nodes = [
      node("a", "image", { assetUrl: "blob:http://localhost:3000/abc-123" }),
      node("b", "video", {
        assetUrl: "/api/v1/canvas/assets/9",
        posterUrl: "blob:http://localhost:3000/poster",
      }),
    ];

    const [uploaded, video] = stripForStorage(nodes);

    expect((uploaded.data as { assetUrl?: string }).assetUrl).toBeUndefined();
    expect((video.data as { assetUrl?: string }).assetUrl).toBe("/api/v1/canvas/assets/9");
    expect((video.data as { posterUrl?: string }).posterUrl).toBeUndefined();
  });

  it("marks an in-flight run interrupted so it does not spin forever", () => {
    const nodes = [
      node("a", "imageGen", { execution: { runId: "r1", status: "running" } }),
      node("b", "imageGen", { execution: { runId: "r2", status: "queued" } }),
    ];

    const stripped = stripForStorage(nodes);

    for (const result of stripped) {
      expect((result.data as { execution: { status: string } }).execution.status).toBe(
        "interrupted",
      );
    }
  });

  it("keeps a video run alive when a server job owns it", () => {
    // 视频任务会在服务端继续运行，因此这种状态确实可以恢复。
    const nodes = [
      node("v", "video", { jobId: "job-1", execution: { runId: "r1", status: "running" } }),
    ];

    const [result] = stripForStorage(nodes);
    expect((result.data as { execution: { status: string } }).execution.status).toBe("running");
  });

  it("leaves terminal executions alone", () => {
    const nodes = [node("a", "imageGen", { execution: { runId: "r1", status: "succeeded" } })];
    const [result] = stripForStorage(nodes);

    expect((result.data as { execution: { status: string } }).execution.status).toBe("succeeded");
  });

  it("clears selection", () => {
    const nodes = [{ ...node("a", "text"), selected: true }];
    expect(stripForStorage(nodes)[0].selected).toBe(false);
  });
});

describe("exportCanvas / importCanvas", () => {
  const nodes = [node("t1", "text", { text: "hello" }), node("g1", "imageGen")];
  const edges: CanvasEdge[] = [{ id: "e1", source: "t1", target: "g1" }];

  it("round-trips a canvas", () => {
    const result = importCanvas(exportCanvas(nodes, edges));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.nodes).toHaveLength(2);
    expect(result.snapshot.edges).toEqual(edges);
  });

  it("never exports inline image data", () => {
    const withInline = [node("i", "image", { assetUrl: "data:image/png;base64,SECRET" })];
    expect(exportCanvas(withInline, [])).not.toContain("SECRET");
  });

  it("rejects malformed input rather than crashing the renderer", () => {
    expect(importCanvas("not json")).toMatchObject({ ok: false });
    expect(importCanvas("[]")).toMatchObject({ ok: false });
    expect(importCanvas(JSON.stringify({ schemaVersion: 1, nodes: [], edges: [] }))).toMatchObject({
      ok: false,
    });
  });

  it("rejects a node with no position", () => {
    const broken = JSON.stringify({
      schemaVersion: 2,
      nodes: [{ id: "a", type: "text", data: {} }],
      edges: [],
    });

    expect(importCanvas(broken)).toMatchObject({ ok: false });
  });

  it("rejects an edge pointing at a node that is not there", () => {
    const broken = JSON.stringify({
      schemaVersion: 2,
      nodes: [{ id: "a", type: "text", position: { x: 0, y: 0 }, data: {} }],
      edges: [{ id: "e", source: "a", target: "ghost" }],
    });

    expect(importCanvas(broken)).toMatchObject({ ok: false });
  });

  it("rejects duplicate node ids", () => {
    const broken = JSON.stringify({
      schemaVersion: 2,
      nodes: [
        { id: "a", type: "text", position: { x: 0, y: 0 }, data: {} },
        { id: "a", type: "text", position: { x: 1, y: 1 }, data: {} },
      ],
      edges: [],
    });

    expect(importCanvas(broken)).toMatchObject({ ok: false });
  });
});
