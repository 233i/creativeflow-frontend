import { describe, expect, it } from "vitest";
import {
  exportWorkflow,
  importWorkflow,
  MAX_WORKFLOW_FILE_BYTES,
  WORKFLOW_FILE_FORMAT,
} from "@/features/workflow/persistence";
import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from "@/features/workflow/types";

function node(
  id: string,
  type: string,
  data: Record<string, unknown> = {},
  position = { x: 10, y: 20 },
): WorkflowNode {
  return { id, type, position, data, selected: true } as WorkflowNode;
}

function file(graph: WorkflowGraph, patch: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: WORKFLOW_FILE_FORMAT,
    formatVersion: 1,
    schemaVersion: 1,
    name: "Imported workflow",
    exportedAt: "2026-08-19T00:00:00.000Z",
    graph,
    ...patch,
  });
}

describe("workflow file import and export", () => {
  it("preserves frame mode, swap setting and legacy image-port order across export/import", () => {
    const frames: WorkflowGraph = {
      nodes: [
        node("first", "image", { assetUrl: "/first.png" }),
        node("last", "image", { assetUrl: "/last.png" }),
        node("video", "videoGenerate", { inputMode: "first-last", reverseFrames: true }),
      ],
      edges: [
        {
          id: "e1",
          source: "first",
          target: "video",
          sourceHandle: "image",
          targetHandle: "image",
        },
        { id: "e2", source: "last", target: "video", sourceHandle: "image", targetHandle: "image" },
      ],
    };
    const result = importWorkflow(exportWorkflow("Frames", frames));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.nodes[2].data).toEqual({ inputMode: "first-last", reverseFrames: true });
    expect(result.graph.edges.map((edge) => edge.source)).toEqual(["first", "last"]);
    expect(result.graph.edges.every((edge) => edge.targetHandle === "image")).toBe(true);
  });

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

  it("round-trips a typed workflow definition", () => {
    const result = importWorkflow(exportWorkflow("Lighthouse", graph));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.name).toBe("Lighthouse");
    expect(result.graph.nodes.map((item) => item.id)).toEqual(["prompt", "generate", "output"]);
    expect(result.graph.edges).toHaveLength(2);
    expect(result.graph.nodes.every((item) => !item.selected)).toBe(true);
  });

  it("round-trips the video-frame continuation node", () => {
    const continuation: WorkflowGraph = {
      nodes: [
        node("video", "videoGenerate", { duration: 5 }),
        node("frame", "videoFrame", { frame: "last" }),
        node("out", "imageOutput"),
      ],
      edges: [
        {
          id: "e1",
          source: "video",
          sourceHandle: "video",
          target: "frame",
          targetHandle: "video",
        },
        { id: "e2", source: "frame", sourceHandle: "image", target: "out", targetHandle: "image" },
      ],
    };

    const result = importWorkflow(exportWorkflow("Continuation", continuation));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.graph.nodes[1].type).toBe("videoFrame");
  });

  it("round-trips the video extension node", () => {
    const extension: WorkflowGraph = {
      nodes: [
        node("prompt", "text", { text: "continue" }),
        node("video", "videoGenerate", { duration: 5 }),
        node("extend", "videoExtend", { duration: 6 }),
        node("out", "videoOutput"),
      ],
      edges: [
        {
          id: "e1",
          source: "prompt",
          sourceHandle: "text",
          target: "extend",
          targetHandle: "prompt",
        },
        {
          id: "e2",
          source: "video",
          sourceHandle: "video",
          target: "extend",
          targetHandle: "video",
        },
        { id: "e3", source: "extend", sourceHandle: "video", target: "out", targetHandle: "video" },
      ],
    };

    const result = importWorkflow(exportWorkflow("Extension", extension));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.graph.nodes[2].type).toBe("videoExtend");
  });

  it("round-trips external API input and output bindings", () => {
    const externalGraph: WorkflowGraph = {
      ...graph,
      externalApi: {
        schemaVersion: 1,
        inputs: [
          {
            key: "prompt",
            label: "Prompt",
            description: "Image prompt",
            type: "string",
            required: true,
            target: { nodeId: "prompt", field: "text" },
            constraints: { maxLength: 1_000 },
          },
        ],
        outputs: [{ key: "image", label: "Generated image", type: "image", nodeId: "output" }],
      },
    };

    const result = importWorkflow(exportWorkflow("Public API", externalGraph));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.externalApi).toEqual(externalGraph.externalApi);
  });

  it("rejects external API bindings that target missing nodes", () => {
    const result = importWorkflow(
      file({
        ...graph,
        externalApi: {
          schemaVersion: 1,
          inputs: [],
          outputs: [{ key: "image", label: "Image", type: "image", nodeId: "missing" }],
        },
      }),
    );

    expect(result).toMatchObject({ ok: false });
  });

  it("exports only portable graph state and drops ephemeral image URLs", () => {
    const json = exportWorkflow("Portable", {
      nodes: [node("image", "image", { assetUrl: "blob:http://localhost/temporary" })],
      edges: [],
    });
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(parsed).toMatchObject({
      format: "creativeflow-workflow",
      formatVersion: 1,
      schemaVersion: 1,
      name: "Portable",
    });
    expect(json).not.toContain("temporary");
    expect(json).not.toContain("selected");
  });

  it("allows an incomplete draft while it is still being edited", () => {
    const result = importWorkflow(file({ nodes: [node("prompt", "text")], edges: [] }));
    expect(result.ok).toBe(true);
  });

  it("keeps importing workflow files exported before the CreativeFlow rename", () => {
    const result = importWorkflow(file(graph, { format: "sol-workflow" }));
    expect(result.ok).toBe(true);
  });

  it("rejects malformed, foreign, and unsupported files", () => {
    expect(importWorkflow("not json")).toMatchObject({ ok: false });
    expect(importWorkflow("[]")).toMatchObject({ ok: false });
    expect(importWorkflow(file(graph, { format: "some-other-app" }))).toMatchObject({ ok: false });
    expect(importWorkflow(file(graph, { formatVersion: 2 }))).toMatchObject({ ok: false });
    expect(importWorkflow(file(graph, { schemaVersion: 2 }))).toMatchObject({ ok: false });
  });

  it("rejects unsupported nodes, duplicate ids, and missing positions", () => {
    expect(importWorkflow(file({ nodes: [node("script", "python")], edges: [] }))).toMatchObject({
      ok: false,
    });
    expect(
      importWorkflow(
        file({
          nodes: [node("same", "text"), node("same", "text")],
          edges: [],
        }),
      ),
    ).toMatchObject({ ok: false });
    expect(
      importWorkflow(
        file({
          nodes: [{ id: "broken", type: "text", data: {} } as WorkflowNode],
          edges: [],
        }),
      ),
    ).toMatchObject({ ok: false });
  });

  it("rejects missing targets, incompatible ports, duplicate edges, and cycles", () => {
    const imageNodes = [node("a", "imageGenerate"), node("b", "imageGenerate")];
    const edge = (
      id: string,
      source: string,
      target: string,
      sourceHandle = "image",
      targetHandle = "image",
    ): WorkflowEdge => ({ id, source, target, sourceHandle, targetHandle });

    expect(
      importWorkflow(
        file({
          nodes: imageNodes,
          edges: [edge("missing", "a", "ghost")],
        }),
      ),
    ).toMatchObject({ ok: false });
    expect(
      importWorkflow(
        file({
          nodes: [node("text", "text"), node("out", "imageOutput")],
          edges: [edge("wrong", "text", "out", "text", "image")],
        }),
      ),
    ).toMatchObject({ ok: false });
    expect(
      importWorkflow(
        file({
          nodes: imageNodes,
          edges: [edge("e1", "a", "b"), edge("e2", "a", "b")],
        }),
      ),
    ).toMatchObject({ ok: false });
    expect(
      importWorkflow(
        file({
          nodes: imageNodes,
          edges: [edge("e1", "a", "b"), edge("e2", "b", "a")],
        }),
      ),
    ).toMatchObject({ ok: false });
  });

  it("enforces the same 2 MB envelope as the workflow API", () => {
    expect(importWorkflow(" ".repeat(MAX_WORKFLOW_FILE_BYTES + 1))).toMatchObject({
      ok: false,
      detail: "file exceeds 2 MB",
    });
  });
});
