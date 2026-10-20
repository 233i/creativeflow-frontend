import { describe, expect, it } from "vitest";
import { createWorkflowNode } from "./node-definitions";
import { parseWorkflowGraph } from "./import-graph";
import { createV2Workflow } from "./snapshot";

function parse(data: unknown, kind = "llm") {
  return parseWorkflowGraph({
    schemaVersion: 1,
    nodes: [{ id: "node", type: kind, position: { x: 0, y: 0 }, data }],
    edges: [],
  });
}

describe("unknown graph input", () => {
  it.each([
    { modelId: 42 },
    { title: {} },
    { maxOutputTokens: "2048" },
    { temperature: NaN },
    { prompt: [{ text: 42 }] },
    { prompt: [{ input: "constructor" }] },
    { outputFields: [{ key: "value", type: "string", required: "yes" }] },
    { outputMode: "xml" },
    { outputTransport: "unknown" },
    { http: {} },
  ])("rejects malformed or foreign model configuration: %j", (patch) => {
    expect(() => parse({ fields: [], ...patch })).toThrow();
  });

  it("rejects malformed HTTP structures before using typed HTTP validation", () => {
    const data = createWorkflowNode("httpRequest", "http", { x: 0, y: 0 }).data;
    for (const http of [
      null,
      "GET",
      {},
      { ...data.http, query: "wrong" },
      { ...data.http, headers: [{ name: 1, value: "text" }] },
    ])
      expect(() => parse({ ...data, http }, "httpRequest")).toThrow();
    expect(() => parse(data, "httpRequest")).not.toThrow();
  });

  it("rejects malformed branches, intents, transforms and resource references", () => {
    const condition = createWorkflowNode("condition", "condition", { x: 0, y: 0 }).data;
    for (const cases of [
      [condition.cases![0], condition.cases![0]],
      [{ ...condition.cases![0], key: "else" }],
      [{ ...condition.cases![0], key: "route" }],
    ])
      expect(() => parse({ ...condition, cases }, "condition")).toThrow();
    expect(() =>
      parse(
        { ...condition, cases: [{ ...condition.cases![0], conditions: "wrong" }] },
        "condition",
      ),
    ).toThrow();
    const intent = createWorkflowNode("intentClassify", "intent", { x: 0, y: 0 }).data;
    expect(() =>
      parse({ ...intent, intents: [intent.intents![0], intent.intents![0]] }, "intentClassify"),
    ).toThrow();
    const transform = createWorkflowNode("transform", "transform", { x: 0, y: 0 }).data;
    expect(() =>
      parse(
        {
          ...transform,
          assignments: [{ key: "other", expression: { op: "input", input: "input" } }],
        },
        "transform",
      ),
    ).toThrow();
    expect(() =>
      parse(
        {
          ...transform,
          assignments: [{ key: "result", expression: { op: "eval", value: "code" } }],
        },
        "transform",
      ),
    ).toThrow();
    const retrieve = createWorkflowNode("knowledgeRetrieve", "retrieve", { x: 0, y: 0 }).data;
    expect(() => parse({ ...retrieve, libraryId: "invalid" }, "knowledgeRetrieve")).toThrow(
      /libraryId/,
    );
  });

  it("rejects optional-to-required dependencies, duplicate gates and cycles during import", () => {
    const graph = createV2Workflow();
    graph.nodes[0].data.fields[0].required = false;
    expect(() => parseWorkflowGraph(graph)).toThrow(/连线/);
    const a = createWorkflowNode("condition", "a", { x: 0, y: 0 });
    const b = createWorkflowNode("condition", "b", { x: 0, y: 0 });
    const gate = {
      id: "gate",
      source: a.id,
      sourceHandle: "matched",
      target: b.id,
      targetHandle: "$flow",
    };
    expect(() =>
      parseWorkflowGraph({
        schemaVersion: 1,
        nodes: [a, b],
        edges: [gate, { ...gate, id: "duplicate" }],
      }),
    ).toThrow(/连线/);
    expect(() =>
      parseWorkflowGraph({
        schemaVersion: 1,
        nodes: [a, b],
        edges: [gate, { ...gate, id: "back", source: b.id, target: a.id }],
      }),
    ).toThrow(/连线/);
  });

  it("preserves draft extensions and strips only renderer state", () => {
    const graph = parse({ fields: [], extension: { futureSetting: "keep" } });
    expect(graph.nodes[0].data).toEqual({ fields: [], extension: { futureSetting: "keep" } });
    expect(() =>
      parseWorkflowGraph({ ...graph, nodes: [{ ...graph.nodes[0], type: "executeSql" }] }),
    ).toThrow(/类型/);
    expect(() =>
      parseWorkflowGraph({
        ...graph,
        nodes: [{ ...graph.nodes[0], position: { x: Infinity, y: 0 } }],
      }),
    ).toThrow(/位置/);
  });
});
