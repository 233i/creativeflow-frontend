import { describe, expect, it } from "vitest";
import {
  canConnect,
  createV2Workflow,
  parseInputs,
  pruneInvalidEdges,
  snapshotGraph,
  type WorkflowField,
} from "./types";
import { createStarterWorkflow } from "../template";

describe("AI workflow typed graph", () => {
  it("creates an explicit v2 graph without changing the legacy starter", () => {
    const graph = createV2Workflow();
    expect(graph.schemaVersion).toBe(1);
    expect(graph.nodes.map((node) => node.type)).toEqual(["start", "llm", "end"]);
    expect(graph.nodes[1].data.modelId).toBe("");
    expect(createStarterWorkflow().nodes.map((node) => node.type)).toEqual([
      "text",
      "imageGenerate",
      "imageOutput",
    ]);
    expect(createStarterWorkflow()).not.toHaveProperty("schemaVersion");
  });

  it("accepts compatible dependencies and rejects duplicate, mismatched and circular connections", () => {
    const graph = createV2Workflow();
    const [start, llm, end] = graph.nodes;
    expect(canConnect({ ...graph, edges: [] }, graph.edges[0])).toBe(true);
    expect(canConnect(graph, graph.edges[0])).toBe(false);
    start.data.fields[0].type = "number";
    expect(canConnect({ ...graph, edges: [] }, graph.edges[0])).toBe(false);
    start.data.fields[0].type = "string";
    start.data.fields[0].required = false;
    expect(canConnect({ ...graph, edges: [] }, graph.edges[0])).toBe(false);
    expect(
      canConnect(
        { ...graph, edges: [] },
        { source: end.id, target: llm.id, sourceHandle: "answer", targetHandle: "question" },
      ),
    ).toBe(false);
    const second = { ...llm, id: "llm2" };
    graph.nodes.push(second);
    graph.edges = [
      {
        id: "back",
        source: second.id,
        sourceHandle: "text",
        target: llm.id,
        targetHandle: "question",
      },
    ];
    expect(
      canConnect(graph, {
        source: llm.id,
        sourceHandle: "text",
        target: second.id,
        targetHandle: "question",
      }),
    ).toBe(false);
  });

  it("preserves JSON types without allowing malformed input or prototype names", () => {
    const fields: WorkflowField[] = [
      { key: "amount", type: "number", required: true },
      { key: "flag", type: "boolean", required: true },
      { key: "context", type: "object", required: false },
      { key: "items", type: "array", required: false },
    ];
    expect(
      parseInputs(fields, { amount: "1.5", flag: "false", context: '{"safe":1}', items: '["a"]' }),
    ).toEqual({ amount: 1.5, flag: false, context: { safe: 1 }, items: ["a"] });
    expect(() => parseInputs(fields, { amount: "", flag: "true" })).toThrow();
    expect(() => parseInputs(fields, { amount: '"3"', flag: "true" })).toThrow();
    expect(() => parseInputs(fields, { amount: "3", flag: "true", context: "[]" })).toThrow();
    expect(() =>
      parseInputs([{ key: "constructor", type: "string", required: true }], { constructor: "x" }),
    ).toThrow();
  });

  it("accepts image fields only as persisted asset references", () => {
    const image: WorkflowField = { key: "image", label: "参考图", type: "image", required: true };
    expect(
      parseInputs([image], { image: '{"assetId":"00000000-0000-0000-0000-000000000001"}' }),
    ).toEqual({ image: { assetId: "00000000-0000-0000-0000-000000000001" } });
    expect(() =>
      parseInputs([image], { image: '{"url":"https://example.test/image.png"}' }),
    ).toThrow(/模式/);
  });

  it("strips renderer and execution state from saved graphs", () => {
    const graph = createV2Workflow();
    graph.nodes[0].selected = true;
    graph.nodes[0].measured = { width: 500, height: 200 };
    graph.edges[0].animated = true;
    const saved = snapshotGraph(graph);
    expect(saved.nodes[0]).not.toHaveProperty("selected");
    expect(saved.nodes[0]).not.toHaveProperty("measured");
    expect(saved.edges[0]).not.toHaveProperty("animated");
    expect(saved.nodes[1].data.prompt).toEqual([{ input: "question" }]);
  });

  it("removes stale field edges without changing valid fan-out connections", () => {
    const graph = createV2Workflow();
    const [start, llm] = graph.nodes;
    graph.edges.push({
      id: "stale",
      source: start.id,
      sourceHandle: "question",
      target: llm.id,
      targetHandle: "removed",
    });
    const repaired = pruneInvalidEdges(graph);
    expect(repaired.edges.map((edge) => edge.id)).toEqual(
      graph.edges.slice(0, 2).map((edge) => edge.id),
    );
  });

  it("removes an existing edge when its output becomes optional without a default", () => {
    const graph = createV2Workflow();
    graph.nodes[0].data.fields[0].required = false;
    expect(canConnect({ ...graph, edges: [] }, graph.edges[0])).toBe(false);
    expect(pruneInvalidEdges(graph).edges).toEqual([graph.edges[1]]);
  });

  it("uses the same cycle rule when cleaning existing edges", () => {
    const graph = createV2Workflow();
    const first = graph.nodes[1];
    const second = { ...first, id: "second" };
    graph.nodes.push(second);
    graph.edges = [
      {
        id: "forward",
        source: first.id,
        sourceHandle: "text",
        target: second.id,
        targetHandle: "question",
      },
      {
        id: "back",
        source: second.id,
        sourceHandle: "text",
        target: first.id,
        targetHandle: "question",
      },
    ];
    expect(pruneInvalidEdges(graph).edges).toEqual([graph.edges[0]]);
  });
});
