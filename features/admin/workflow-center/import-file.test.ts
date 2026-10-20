import { describe, expect, it } from "vitest";
import { createV2Workflow } from "@/features/workflow/v2/types";
import { exportWorkflow } from "@/features/workflow/persistence";
import { importCenterWorkflow } from "./import-file";

function file(graph: unknown) {
  return JSON.stringify({
    format: "creativeflow-workflow",
    formatVersion: 1,
    schemaVersion: 1,
    name: "合成导入",
    graph,
  });
}

describe("center workflow imports", () => {
  it("round trips a typed graph without inventing permissions, origin or run history", () => {
    const graph = createV2Workflow();
    const imported = importCenterWorkflow(file(graph));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error(imported.detail);
    expect(imported.graph).toEqual(graph);
    expect(imported).not.toHaveProperty("copyOrigin");
    expect(imported).not.toHaveProperty("run");
  });
  it("retains the original media format validator", () => {
    const result = importCenterWorkflow(exportWorkflow("合成媒体", { nodes: [], edges: [] }));
    expect(result).toEqual({ ok: true, name: "合成媒体", graph: { nodes: [], edges: [] } });
  });
  it("rejects duplicate nodes, unsupported types, invalid ports and malformed JSON", () => {
    const graph = createV2Workflow();
    for (const invalid of [
      { ...graph, nodes: [...graph.nodes, graph.nodes[0]] },
      { ...graph, nodes: [{ ...graph.nodes[0], type: "executeArbitrarySql" }] },
      { ...graph, edges: [{ ...graph.edges[0], sourceHandle: "nonexistent" }] },
      { ...graph, nodes: [{ ...graph.nodes[0], data: { fields: "not-an-array" } }] },
      {
        ...graph,
        nodes: [
          {
            ...graph.nodes[0],
            data: { fields: [{ key: "constructor", type: "string", required: true }] },
          },
        ],
      },
    ])
      expect(importCenterWorkflow(file(invalid)).ok).toBe(false);
    expect(importCenterWorkflow("{").ok).toBe(false);
  });
  it("rejects malformed resource references before creating a workflow", () => {
    const graph = createV2Workflow();
    const invalid = {
      ...graph,
      nodes: graph.nodes.map((node) => ({
        ...node,
        data: { ...node.data, libraryId: "https://untrusted.invalid" },
      })),
    };
    const result = importCenterWorkflow(file(invalid));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toContain("libraryId");
  });
  it("enforces file and node limits", () => {
    expect(importCenterWorkflow(" ".repeat(2 * 1024 * 1024 + 1)).ok).toBe(false);
    const graph = createV2Workflow();
    expect(
      importCenterWorkflow(
        file({
          ...graph,
          nodes: Array.from({ length: 41 }, (_, index) => ({
            ...graph.nodes[1],
            id: `node-${index}`,
          })),
        }),
      ).ok,
    ).toBe(false);
  });
});
