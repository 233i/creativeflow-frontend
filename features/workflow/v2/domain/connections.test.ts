import { describe, expect, it } from "vitest";
import type { Edge } from "@xyflow/react";
import { canConnect, pruneInvalidEdges } from "./connections";
import { CONTROL_PORT, createWorkflowNode } from "./node-definitions";
import type { WorkflowField } from "./fields";
import type { WorkflowV2Graph } from "./nodes";

function graph(): WorkflowV2Graph {
  return {
    schemaVersion: 1,
    nodes: (["start", "llm", "end", "condition", "merge"] as const).map((kind) =>
      createWorkflowNode(kind, kind, { x: 0, y: 0 }),
    ),
    edges: [],
  };
}
const edge: Edge = {
  id: "edge",
  source: "start",
  sourceHandle: "question",
  target: "llm",
  targetHandle: "question",
};

describe("shared connection rules", () => {
  it.each<
    [
      {
        name: string;
        output: Partial<WorkflowField>;
        input?: Partial<WorkflowField>;
        accepted: boolean;
      },
    ]
  >([
    [{ name: "required source", output: { required: true }, accepted: true }],
    [{ name: "optional source", output: { required: false }, accepted: false }],
    [
      {
        name: "optional target",
        output: { required: false },
        input: { required: false },
        accepted: true,
      },
    ],
    [{ name: "empty string default", output: { required: false, default: "" }, accepted: true }],
    [
      {
        name: "false default",
        output: { type: "boolean", required: false, default: false },
        input: { type: "boolean" },
        accepted: true,
      },
    ],
    [
      {
        name: "zero default",
        output: { type: "number", required: false, default: 0 },
        input: { type: "number" },
        accepted: true,
      },
    ],
    [
      {
        name: "target default does not guarantee source",
        output: { required: false },
        input: { default: "fallback" },
        accepted: false,
      },
    ],
    [{ name: "type mismatch", output: { type: "number" }, accepted: false }],
    [{ name: "renamed output", output: { key: "renamed" }, accepted: false }],
    [{ name: "renamed input", output: {}, input: { key: "renamed" }, accepted: false }],
  ])("agrees when creating and cleaning: $name", ({ output, input, accepted }) => {
    const current = graph();
    Object.assign(current.nodes[0].data.fields[0], output);
    Object.assign(current.nodes[1].data.fields[0], input);
    expect(canConnect(current, edge)).toBe(accepted);
    expect(pruneInvalidEdges({ ...current, edges: [edge] }).edges).toEqual(accepted ? [edge] : []);
  });

  it.each(["source", "target"] as const)("removes edges after %s fields are deleted", (side) => {
    const current = graph();
    current.nodes[side === "source" ? 0 : 1].data.fields = [];
    expect(canConnect(current, edge)).toBe(false);
    expect(pruneInvalidEdges({ ...current, edges: [edge] }).edges).toEqual([]);
  });

  it("preserves fan-out and the first source while rejecting duplicate ordinary inputs", () => {
    const current = graph();
    const other = { ...edge, id: "other", target: "end", targetHandle: "answer" };
    current.edges = [edge, { ...edge, id: "duplicate" }, other];
    expect(pruneInvalidEdges(current).edges).toEqual([edge, other]);
    const clean = { ...current, edges: [edge, other] };
    expect(pruneInvalidEdges(clean)).toBe(clean);
  });

  it("preserves distinct merge sources while rejecting the same source twice", () => {
    const current = graph();
    const first = { ...edge, target: "merge", targetHandle: "result" };
    const second = { ...first, id: "second", source: "llm", sourceHandle: "text" };
    current.edges = [first, second, { ...second, id: "duplicate" }];
    expect(pruneInvalidEdges(current).edges).toEqual([first, second]);
  });

  it("shares branch controls, single gates, terminal and cycle rules", () => {
    const current = graph();
    const control = {
      id: "gate",
      source: "condition",
      sourceHandle: "matched",
      target: "llm",
      targetHandle: CONTROL_PORT,
    };
    expect(canConnect(current, control)).toBe(true);
    for (const invalid of [
      { ...control, source: "start" },
      { ...control, sourceHandle: "route" },
      { ...control, sourceHandle: "deleted" },
      { ...control, target: "end" },
      { ...control, target: "start" },
      { ...control, target: "condition" },
      { ...control, source: "missing" },
      { ...control, targetHandle: "question" },
    ]) {
      expect(canConnect(current, invalid)).toBe(false);
      expect(pruneInvalidEdges({ ...current, edges: [invalid] }).edges).toEqual([]);
    }
    current.nodes[3].data.fields = [{ key: "text", type: "string", required: true }];
    const back = {
      id: "back",
      source: "llm",
      sourceHandle: "text",
      target: "condition",
      targetHandle: "text",
    };
    current.edges = [control, { ...control, id: "duplicate", sourceHandle: "else" }, back];
    expect(pruneInvalidEdges(current).edges).toEqual([control]);
  });

  it("keeps intent control ports separate from route data and removes renamed cases", () => {
    const current = graph();
    const intent = createWorkflowNode("intentClassify", "intent", { x: 0, y: 0 });
    current.nodes.push(intent);
    const control = {
      id: "intent-gate",
      source: intent.id,
      sourceHandle: "question",
      target: "llm",
      targetHandle: CONTROL_PORT,
    };
    expect(canConnect(current, control)).toBe(true);
    intent.data.intents![0].key = "renamed";
    expect(pruneInvalidEdges({ ...current, edges: [control] }).edges).toEqual([]);
    expect(
      canConnect(current, { ...control, sourceHandle: "route", targetHandle: "question" }),
    ).toBe(true);
    expect(canConnect(current, { ...control, sourceHandle: "else" })).toBe(true);
  });
});
