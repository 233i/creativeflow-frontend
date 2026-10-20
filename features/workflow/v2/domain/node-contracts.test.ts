import { describe, expect, expectTypeOf, it } from "vitest";
import baseline from "./fixtures/node-contracts.json";
import {
  createWorkflowNode,
  defaultData,
  inputFields,
  isWorkflowV2Kind,
  NODE_DEFINITIONS,
  NODE_KINDS,
  outputFields,
} from "./node-definitions";
import type { WorkflowV2Node } from "./nodes";
import { parseWorkflowGraph } from "./import-graph";
import { snapshotGraph } from "./snapshot";
import { importCenterWorkflow } from "@/features/admin/workflow-center/import-file";

describe("node contracts across the P1 refactor", () => {
  it.each(baseline)("preserves $type defaults, ports and capabilities", (saved) => {
    if (!isWorkflowV2Kind(saved.type)) throw new Error("Unknown fixture node");
    const node = createWorkflowNode(saved.type, saved.type, { x: 10, y: 20 });
    const definition = NODE_DEFINITIONS[saved.type];
    expect(node.data).toEqual(saved.data);
    expect(outputFields(node)).toEqual(saved.outputs);
    expect(inputFields(node)).toEqual(saved.type === "start" ? [] : saved.data.fields);
    expect(definition).toMatchObject({
      label: saved.label,
      group: saved.group,
      usesModel: saved.usesModel,
      branch: saved.branch,
    });
    node.data.fields[0].key = "changed";
    expect(defaultData(saved.type)).toEqual(saved.data);
  });

  it("round trips all existing node kinds through persisted JSON and the public importer", () => {
    const nodes = baseline.map((saved) => ({
      id: saved.type,
      type: saved.type,
      data: saved.data,
      position: { x: 10, y: 20 },
      selected: true,
      measured: { width: 100 },
      dragging: true,
    }));
    const first = parseWorkflowGraph({ schemaVersion: 1, nodes, edges: [] });
    expect(first.nodes.map((node) => node.type)).toEqual(
      NODE_KINDS.filter((kind) => baseline.some((item) => item.type === kind)),
    );
    const saved = snapshotGraph(first);
    const loaded = parseWorkflowGraph(JSON.parse(JSON.stringify(saved)));
    const exported = JSON.stringify({
      format: "creativeflow-workflow",
      formatVersion: 1,
      schemaVersion: 1,
      name: "已有节点样本",
      graph: loaded,
    });
    expect(importCenterWorkflow(exported)).toEqual({
      ok: true,
      name: "已有节点样本",
      graph: first,
    });
    for (const node of loaded.nodes)
      expect(Object.keys(node).sort()).toEqual(["data", "id", "position", "type"]);
  });

  it("infers configuration from the discriminant while retaining incomplete drafts", () => {
    const llm = createWorkflowNode("llm", "llm", { x: 0, y: 0 });
    expectTypeOf(llm).toExtend<WorkflowV2Node<"llm">>();
    expectTypeOf(llm.data.modelId).toEqualTypeOf<string | undefined>();
    expectTypeOf(llm.data.http).toEqualTypeOf<undefined>();
    expect(
      parseWorkflowGraph({ schemaVersion: 1, nodes: [{ ...llm, data: { fields: [] } }], edges: [] })
        .nodes[0].data,
    ).toEqual({ fields: [] });
    expect(defaultData("httpRequest").http?.url).toBe("");
    expect(defaultData("knowledgeRetrieve").libraryId).toBe("");
    expect(defaultData("loop").maxItems).toBe(100);
    expect(defaultData("batch").batchSize).toBe(10);
  });
});

// These assignments are checked by tsc, not executed by the test runner.
export function verifyNodeTypeErrors(node: WorkflowV2Node<"llm">) {
  // @ts-expect-error HTTP configuration cannot be attached to an LLM node.
  node.data.http = defaultData("httpRequest").http;
  // @ts-expect-error The discriminant is required, including for an empty draft.
  const missingKind: WorkflowV2Node = {
    id: "node",
    position: { x: 0, y: 0 },
    data: { fields: [] },
  };
  return missingKind;
}
