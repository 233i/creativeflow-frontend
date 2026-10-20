import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { V2BranchConfig, V2ExecutionGate, operators } from "./branch-config";
import { V2NodeConfig } from "./node-config";
import {
  branchPorts,
  canConnect,
  CONTROL_PORT,
  defaultData,
  createWorkflowNode,
  outputFields,
  snapshotGraph,
  type WorkflowV2Graph,
  type WorkflowV2NodeData,
} from "./types";
import { droppedKind, placeNode } from "./placement";

vi.mock("@/features/ai/store", () => ({
  useAiStore: (select: (state: { providers: [] }) => unknown) => select({ providers: [] }),
}));
function graph(): WorkflowV2Graph {
  return {
    schemaVersion: 1,
    edges: [],
    nodes: (["start", "condition", "merge", "llm", "end"] as const).map((type) =>
      createWorkflowNode(type, type, { x: 0, y: 0 }),
    ),
  };
}

describe("conditional workflow configuration", () => {
  it("places dragged nodes at canvas coordinates without cloning terminal nodes or trusting foreign payloads", () => {
    const current = graph();
    const placed = placeNode(current, "condition", { x: 120, y: -50 }, "new-condition");
    expect(placed.graph.nodes.at(-1)).toMatchObject({
      id: "new-condition",
      type: "condition",
      position: { x: 120, y: -50 },
      data: defaultData("condition"),
    });
    expect(current.nodes).toHaveLength(5);
    const terminal = placeNode(current, "start", { x: 90, y: 10 }, "ignored");
    expect(terminal.nodeId).toBe("start");
    expect(terminal.graph.nodes).toHaveLength(5);
    expect(terminal.graph.edges).toEqual(current.edges);
    expect(droppedKind("condition", ["start", "condition"])).toBe("condition");
    expect(droppedKind('{"type":"condition","apiKey":"injected"}', ["condition"])).toBeNull();
    expect(droppedKind("knowledgeRetrieve", ["start", "condition"])).toBeNull();
    expect(() => placeNode(current, "llm", { x: NaN, y: 0 }, "new")).toThrow();
  });
  it("separates control ports from data and rejects wrong sources, duplicate gates and cycles", () => {
    const current = graph();
    const control = {
      source: "condition",
      sourceHandle: "matched",
      target: "llm",
      targetHandle: CONTROL_PORT,
    };
    expect(canConnect(current, control)).toBe(true);
    expect(canConnect(current, { ...control, source: "start" })).toBe(false);
    expect(canConnect(current, { ...control, sourceHandle: "route" })).toBe(false);
    expect(canConnect(current, { ...control, target: "end" })).toBe(false);
    current.edges.push({ ...control, id: "gate" });
    expect(canConnect(current, { ...control, sourceHandle: "else" })).toBe(false);
    current.nodes[1].data.fields = [{ key: "text", type: "string", required: true }];
    expect(
      canConnect(current, {
        source: "llm",
        sourceHandle: "text",
        target: "condition",
        targetHandle: "text",
      }),
    ).toBe(false);
    expect(snapshotGraph(current).edges[0]).toEqual({ ...control, id: "gate" });
  });

  it("permits multiple distinct merge candidates but preserves the single-source rule elsewhere", () => {
    const current = graph();
    current.edges.push({
      id: "one",
      source: "llm",
      sourceHandle: "text",
      target: "merge",
      targetHandle: "result",
    });
    expect(
      canConnect(current, {
        source: "start",
        sourceHandle: "question",
        target: "merge",
        targetHandle: "result",
      }),
    ).toBe(true);
    expect(
      canConnect(current, {
        source: "llm",
        sourceHandle: "text",
        target: "merge",
        targetHandle: "result",
      }),
    ).toBe(false);
    expect(outputFields(current.nodes[2])).toEqual(current.nodes[2].data.fields);
    expect(branchPorts(current.nodes[1].data).at(-1)?.key).toBe("else");
  });

  it("exposes only nominal evidence predicates, never arbitrary object comparisons", () => {
    expect(operators("contextChunks")).toEqual(["hasHits", "noHits", "isPresent", "isMissing"]);
    expect(operators("answer")).toContain("isGrounded");
    expect(operators("object")).not.toContain("hasHits");
    expect(operators("string")).not.toContain("gte");
  });

  it("edits AND/OR, adds conditions and ordered ELSE IF cases", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [data, change] = useState(defaultData("condition"));
      return (
        <>
          <V2BranchConfig data={data} onChange={change} />
          <output data-testid="config">{JSON.stringify(data)}</output>
        </>
      );
    }
    render(<Harness />);
    await user.selectOptions(screen.getByLabelText("分支 1 组合方式"), "any");
    await user.click(screen.getByText("＋ 添加条件"));
    await user.selectOptions(screen.getByLabelText("分支 1 条件 2 运算"), "isFalse");
    await user.click(screen.getByText("＋ ELSE IF 分支"));
    const state = JSON.parse(screen.getByTestId("config").textContent!) as WorkflowV2NodeData;
    expect(state.cases).toHaveLength(2);
    expect(state.cases![0].match).toBe("any");
    expect(state.cases![0].conditions[1]).toEqual({ input: "flag", operator: "isFalse" });
    expect(screen.getByText("ELSE · 默认分支（以上均不满足）")).toBeInTheDocument();
  });

  it("binds a gate to a real control edge and leaves missing gates explicit", async () => {
    const user = userEvent.setup();
    const bind = vi.fn();
    const current = graph();
    render(<V2ExecutionGate node={current.nodes[3]} graph={current} onBind={bind} />);
    await user.selectOptions(
      screen.getByLabelText("执行条件"),
      JSON.stringify(["condition", "else"]),
    );
    expect(bind).toHaveBeenCalledExactlyOnceWith(CONTROL_PORT, "condition", "else");
  });

  it("maps multiple merge sources in the real node configuration", async () => {
    const user = userEvent.setup();
    const bind = vi.fn();
    const current = graph();
    current.edges.push({
      id: "one",
      source: "llm",
      sourceHandle: "text",
      target: "merge",
      targetHandle: "result",
    });
    render(
      <V2NodeConfig
        node={current.nodes[2]}
        graph={current}
        onChange={vi.fn()}
        onBind={bind}
        onRemove={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText("字段 1 来源 开始 · question"));
    expect(bind).toHaveBeenLastCalledWith("result", "llm", "text", [["start", "question"]]);
  });

  it("supports an explicit preset result without a model and forbids evidence defaults", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    const current = graph();
    const props = {
      node: current.nodes[2],
      graph: current,
      onChange: change,
      onBind: vi.fn(),
      onRemove: vi.fn(),
    };
    const { rerender } = render(<V2NodeConfig {...props} />);
    await user.click(screen.getByLabelText("字段 1 使用默认值"));
    expect(change).toHaveBeenLastCalledWith(
      expect.objectContaining({ fields: [expect.objectContaining({ default: "" })] }),
    );
    rerender(
      <V2NodeConfig
        {...props}
        node={{
          ...props.node,
          data: { fields: [{ key: "evidence", type: "answer", required: false }] },
        }}
      />,
    );
    expect(screen.queryByLabelText("字段 1 使用默认值")).not.toBeInTheDocument();
  });
});
