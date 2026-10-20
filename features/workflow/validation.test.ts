import { describe, expect, it } from "vitest";
import type { WorkflowGraph, WorkflowNode } from "@/features/workflow/types";
import { isValidWorkflowConnection, validateWorkflow } from "@/features/workflow/validation";

function node(id: string, type: string, data: Record<string, unknown> = {}): WorkflowNode {
  return { id, type, position: { x: 0, y: 0 }, data } as WorkflowNode;
}

describe("workflow validation", () => {
  it("rejects three uploaded frames but keeps reference-mode and runtime-generated inputs available", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node("a", "image", { assetUrl: "/a" }),
        node("b", "image", { assetUrl: "/b" }),
        node("c", "image", { assetUrl: "/c" }),
        node("video", "videoGenerate", { inputMode: "first-last" }),
        node("out", "videoOutput"),
      ],
      edges: [
        ...["a", "b", "c"].map((id) => ({
          id,
          source: id,
          sourceHandle: "image",
          target: "video",
          targetHandle: "image",
        })),
        { id: "out", source: "video", sourceHandle: "video", target: "out", targetHandle: "video" },
      ],
    };
    expect(validateWorkflow(graph)).toContainEqual({ code: "tooManyVideoFrames", nodeId: "video" });
    graph.nodes[3].data.inputMode = "reference";
    expect(validateWorkflow(graph)).toEqual([]);
    graph.nodes[3].data.inputMode = "first-last";
    graph.nodes[2] = node("c", "imageGenerate", { count: 1 });
    graph.edges.push({
      id: "a-c",
      source: "a",
      sourceHandle: "image",
      target: "c",
      targetHandle: "image",
    });
    expect(validateWorkflow(graph).some((issue) => issue.code === "tooManyVideoFrames")).toBe(
      false,
    );
  });

  it("accepts the typed text-to-image pipeline", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node("prompt", "text", { text: "a lighthouse" }),
        node("generate", "imageGenerate", { count: 1 }),
        node("output", "imageOutput"),
      ],
      edges: [
        {
          id: "e1",
          source: "prompt",
          sourceHandle: "text",
          target: "generate",
          targetHandle: "prompt",
        },
        {
          id: "e2",
          source: "generate",
          sourceHandle: "image",
          target: "output",
          targetHandle: "image",
        },
      ],
    };

    expect(validateWorkflow(graph)).toEqual([]);
  });

  it("rejects a text output connected to an image port", () => {
    const nodes = [node("prompt", "text", { text: "hello" }), node("output", "imageOutput")];

    expect(
      isValidWorkflowConnection(
        {
          source: "prompt",
          sourceHandle: "text",
          target: "output",
          targetHandle: "image",
        },
        nodes,
        [],
      ),
    ).toBe(false);
  });

  it("accepts the typed image-to-video pipeline with a video result node", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node("image", "image", {
          assetUrl: "/api/v1/canvas/assets/0191c30e-70af-7000-8000-000000000001",
        }),
        node("generate", "videoGenerate", { duration: 5 }),
        node("output", "videoOutput"),
      ],
      edges: [
        {
          id: "e1",
          source: "image",
          sourceHandle: "image",
          target: "generate",
          targetHandle: "image",
        },
        {
          id: "e2",
          source: "generate",
          sourceHandle: "video",
          target: "output",
          targetHandle: "video",
        },
      ],
    };

    expect(validateWorkflow(graph)).toEqual([]);
  });

  it("accepts continuing a video through an extracted last frame", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node("prompt", "text", { text: "continue" }),
        node("first", "videoGenerate", { duration: 5 }),
        node("checkpoint", "videoOutput"),
        node("frame", "videoFrame", { frame: "last" }),
        node("second", "videoGenerate", { duration: 5, inputMode: "first-last" }),
        node("out", "videoOutput"),
      ],
      edges: [
        {
          id: "e1",
          source: "prompt",
          sourceHandle: "text",
          target: "first",
          targetHandle: "prompt",
        },
        {
          id: "e2",
          source: "first",
          sourceHandle: "video",
          target: "checkpoint",
          targetHandle: "video",
        },
        {
          id: "e3",
          source: "checkpoint",
          sourceHandle: "video",
          target: "frame",
          targetHandle: "video",
        },
        {
          id: "e4",
          source: "frame",
          sourceHandle: "image",
          target: "second",
          targetHandle: "image",
        },
        { id: "e5", source: "second", sourceHandle: "video", target: "out", targetHandle: "video" },
      ],
    };

    expect(validateWorkflow(graph)).toEqual([]);
  });

  it("accepts extending one video with a continuation prompt", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node("prompt", "text", { text: "keep walking" }),
        node("first", "videoGenerate", { duration: 5 }),
        node("extend", "videoExtend", { duration: 6 }),
        node("out", "videoOutput"),
      ],
      edges: [
        {
          id: "e1",
          source: "prompt",
          sourceHandle: "text",
          target: "first",
          targetHandle: "prompt",
        },
        {
          id: "e2",
          source: "prompt",
          sourceHandle: "text",
          target: "extend",
          targetHandle: "prompt",
        },
        {
          id: "e3",
          source: "first",
          sourceHandle: "video",
          target: "extend",
          targetHandle: "video",
        },
        { id: "e4", source: "extend", sourceHandle: "video", target: "out", targetHandle: "video" },
      ],
    };

    expect(validateWorkflow(graph, { videoExtensionSupported: true })).toEqual([]);
  });

  it("reports an unsupported video extension model before execution", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node("prompt", "text", { text: "keep walking" }),
        node("first", "videoGenerate", { duration: 5 }),
        node("extend", "videoExtend", { duration: 6 }),
        node("out", "videoOutput"),
      ],
      edges: [
        {
          id: "e1",
          source: "prompt",
          sourceHandle: "text",
          target: "first",
          targetHandle: "prompt",
        },
        {
          id: "e2",
          source: "prompt",
          sourceHandle: "text",
          target: "extend",
          targetHandle: "prompt",
        },
        {
          id: "e3",
          source: "first",
          sourceHandle: "video",
          target: "extend",
          targetHandle: "video",
        },
        { id: "e4", source: "extend", sourceHandle: "video", target: "out", targetHandle: "video" },
      ],
    };

    expect(validateWorkflow(graph, { videoExtensionSupported: false })).toContainEqual({
      code: "missingVideoExtensionModel",
      nodeId: "extend",
    });
  });

  it("does not allow a video edge into an image result node", () => {
    const nodes = [node("generate", "videoGenerate"), node("output", "imageOutput")];

    expect(
      isValidWorkflowConnection(
        {
          source: "generate",
          sourceHandle: "video",
          target: "output",
          targetHandle: "image",
        },
        nodes,
        [],
      ),
    ).toBe(false);
  });

  it("allows an image result to continue into image or video generation", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node("prompt", "text", { text: "a lighthouse at dusk" }),
        node("first-generation", "imageGenerate", { count: 1 }),
        node("image-result", "imageOutput"),
        node("image-variation", "imageGenerate", { count: 1 }),
        node("video-generation", "videoGenerate", { duration: 5 }),
        node("variation-result", "imageOutput"),
        node("video-result", "videoOutput"),
      ],
      edges: [
        {
          id: "e1",
          source: "prompt",
          sourceHandle: "text",
          target: "first-generation",
          targetHandle: "prompt",
        },
        {
          id: "e2",
          source: "first-generation",
          sourceHandle: "image",
          target: "image-result",
          targetHandle: "image",
        },
        {
          id: "e3",
          source: "image-result",
          sourceHandle: "image",
          target: "image-variation",
          targetHandle: "image",
        },
        {
          id: "e4",
          source: "image-result",
          sourceHandle: "image",
          target: "video-generation",
          targetHandle: "image",
        },
        {
          id: "e5",
          source: "image-variation",
          sourceHandle: "image",
          target: "variation-result",
          targetHandle: "image",
        },
        {
          id: "e6",
          source: "video-generation",
          sourceHandle: "video",
          target: "video-result",
          targetHandle: "video",
        },
      ],
    };

    expect(validateWorkflow(graph)).toEqual([]);
  });

  it("keeps the legacy mixed output node valid for saved workflows", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node("prompt", "text", { text: "legacy" }),
        node("generate", "imageGenerate"),
        node("output", "output"),
      ],
      edges: [
        {
          id: "e1",
          source: "prompt",
          sourceHandle: "text",
          target: "generate",
          targetHandle: "prompt",
        },
        {
          id: "e2",
          source: "generate",
          sourceHandle: "image",
          target: "output",
          targetHandle: "image",
        },
      ],
    };

    expect(validateWorkflow(graph)).toEqual([]);
  });

  it("rejects a connection that closes a cycle", () => {
    const nodes = [node("a", "imageGenerate"), node("b", "imageGenerate")];
    const edges = [
      { id: "e1", source: "a", sourceHandle: "image", target: "b", targetHandle: "image" },
    ];

    expect(
      isValidWorkflowConnection(
        {
          source: "b",
          sourceHandle: "image",
          target: "a",
          targetHandle: "image",
        },
        nodes,
        edges,
      ),
    ).toBe(false);
  });
});
