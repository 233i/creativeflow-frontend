import { describe, expect, it } from "vitest";
import type { WorkflowEdge, WorkflowNode } from "@/features/workflow/types";
import { orderedVideoFrames, workflowVideoImages } from "@/features/workflow/video-inputs";

/** 构造无需 React Flow 运行时的图片来源节点。 */
function source(id: string, type = "image", data: Record<string, unknown> = {}): WorkflowNode {
  return { id, type, data, position: { x: 0, y: 0 } } as WorkflowNode;
}

/** 通过旧 image 端口连接图片，测试顺序不依赖节点排列或位置。 */
function edge(id: string, sourceId: string, target = "video"): WorkflowEdge {
  return { id, source: sourceId, target, sourceHandle: "image", targetHandle: "image" };
}

describe("workflow frame image preview", () => {
  it("uses connection order and follows pass-through image result nodes", () => {
    const nodes = [
      source("b", "image", { assetUrl: "/b" }),
      source("a", "image", { assetUrl: "/a" }),
      source("out", "imageOutput"),
    ];
    const images = workflowVideoImages("video", nodes, [
      edge("a-out", "a", "out"),
      edge("out-video", "out"),
      edge("b-video", "b"),
    ]);
    expect(images.map((image) => image.url)).toEqual(["/a", "/b"]);
  });

  it("keeps duplicate image inputs because they may intentionally use the same frame", () => {
    const images = workflowVideoImages(
      "video",
      [source("a", "image", { assetUrl: "/a" }), source("out", "imageOutput")],
      [edge("a-video", "a"), edge("a-out", "a", "out"), edge("out-video", "out")],
    );
    expect(images.map((image) => image.url)).toEqual(["/a", "/a"]);
  });

  it("shows generated outputs as placeholders and bounds oversized expansions", () => {
    const images = workflowVideoImages(
      "video",
      [source("generated", "imageGenerate", { count: 1000 })],
      [edge("e", "generated")],
    );
    expect(images).toHaveLength(3);
    expect(images.every((image) => image.pending && !image.url)).toBe(true);
    expect(images.map((image) => image.index)).toEqual([1, 2, 3]);
  });

  it("handles last-frame extraction and incomplete cyclic drafts", () => {
    expect(
      workflowVideoImages("video", [source("frame", "videoFrame")], [edge("e", "frame")]),
    ).toEqual([{ sourceId: "frame", index: 1, pending: true }]);
    expect(
      workflowVideoImages(
        "video",
        [source("out", "imageOutput")],
        [edge("a", "out"), edge("b", "out", "out")],
      ),
    ).toEqual([]);
  });

  it("swaps exactly two frames without modifying reference-mode order or upstream data", () => {
    const images = Object.freeze(["/a", "/b"]);
    expect(orderedVideoFrames(images, "first-last", true)).toEqual(["/b", "/a"]);
    expect(orderedVideoFrames(images, "reference", true)).toBe(images);
    expect(orderedVideoFrames(images, "first-last", undefined)).toBe(images);
    expect(orderedVideoFrames(["/a"], "first-last", true)).toEqual(["/a"]);
    expect(orderedVideoFrames(["/a", "/b", "/c"], "first-last", true)).toEqual(["/a", "/b", "/c"]);
    expect(images).toEqual(["/a", "/b"]);
  });
});
