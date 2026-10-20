import { describe, expect, it } from "vitest";
import type { WorkflowNodeRun, WorkflowRun } from "../types";
import { CONTROL_PORT, createWorkflowNode, snapshotGraph, type WorkflowV2Graph } from "./types";
import {
  elapsedSeconds,
  executionEdges,
  formatDuration,
  nodeRunLabel,
  reportedProgress,
  runSummary,
} from "./run-presentation";

const time = "2026-09-13T00:00:00Z";
function node(
  id: string,
  status: WorkflowNodeRun["status"],
  patch: Partial<WorkflowNodeRun> = {},
): WorkflowNodeRun {
  return {
    nodeId: id,
    nodeType: "text",
    status,
    isReused: false,
    progress: null,
    output: null,
    error: null,
    startedAt: time,
    finishedAt: null,
    ...patch,
  };
}
function run(nodes: WorkflowNodeRun[], status: WorkflowRun["status"] = "running"): WorkflowRun {
  return {
    id: "run",
    workflowId: "workflow",
    resumedFromRunId: null,
    status,
    error: null,
    createdAt: time,
    updatedAt: time,
    startedAt: time,
    finishedAt: null,
    nodes,
  };
}
function graph(): WorkflowV2Graph {
  return {
    schemaVersion: 1,
    nodes: (["start", "condition", "llm", "httpRequest", "end"] as const).map((type) =>
      createWorkflowNode(type, type, { x: 0, y: 0 }),
    ),
    edges: [
      {
        id: "data",
        source: "start",
        sourceHandle: "question",
        target: "llm",
        targetHandle: "question",
      },
      {
        id: "hit",
        source: "condition",
        sourceHandle: "matched",
        target: "llm",
        targetHandle: CONTROL_PORT,
      },
      {
        id: "else",
        source: "condition",
        sourceHandle: "else",
        target: "httpRequest",
        targetHandle: CONTROL_PORT,
      },
      { id: "result", source: "llm", sourceHandle: "text", target: "end", targetHandle: "answer" },
    ],
  };
}

describe("v2 execution presentation without changing graph semantics", () => {
  it("only shows finite server progress, clamped to its documented range", () => {
    expect([null, undefined, NaN, Infinity].map(reportedProgress)).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect([-1, 0, 0.456, 1, 2].map(reportedProgress)).toEqual([0, 0, 46, 100, 100]);
  });

  it("uses live elapsed time while running and fixed terminal time afterwards", () => {
    const now = Date.parse(time) + 95000;
    expect(elapsedSeconds(time, null, now)).toBe(95);
    expect(elapsedSeconds(time, "2026-09-13T00:00:12Z", now)).toBe(12);
    expect(elapsedSeconds(null, null, now)).toBe(0);
    expect(elapsedSeconds("invalid", null, now)).toBe(0);
    expect(elapsedSeconds(time, null, Date.parse(time) - 1000)).toBe(0);
    expect(formatDuration(95)).toBe("1 分 35 秒");
    expect(formatDuration(9)).toBe("9 秒");
  });

  it("distinguishes completed, skipped, pending and reused nodes without invented model progress", () => {
    const current = run([
      node("a", "succeeded", { isReused: true }),
      node("b", "running"),
      node("c", "skipped"),
      node("d", "queued"),
    ]);
    expect(runSummary(current)).toMatchObject({
      completed: 1,
      skipped: 1,
      settled: 2,
      total: 4,
      progress: 50,
      current: { nodeId: "b" },
    });
    current.nodes[1].progress = 0.4;
    expect(runSummary(current).progress).toBe(60);
    expect(runSummary(run([], "queued"))).toMatchObject({ progress: 0, current: undefined });
    expect(runSummary(run([node("a", "queued")], "queued")).current).toBeUndefined();
    current.status = "failed";
    expect(runSummary(current)).toMatchObject({ current: undefined, active: false, progress: 50 });
  });

  it("uses the available node name with a type fallback for historical removed nodes", () => {
    const current = graph();
    current.nodes[0].data.title = "输入问题";
    expect(nodeRunLabel(node("start", "succeeded"), current)).toBe("输入问题");
    expect(
      nodeRunLabel(
        node("gone", "succeeded", { nodeType: "llm" as WorkflowNodeRun["nodeType"] }),
        current,
      ),
    ).toBe("LLM");
  });

  it("animates active data and selected control edges but keeps the unselected branch subdued", () => {
    const current = graph();
    const original = structuredClone(current);
    const state = run([
      node("start", "succeeded"),
      node("condition", "succeeded", { output: { fields: { route: "matched" } } }),
      node("llm", "running"),
      node("httpRequest", "queued"),
      node("end", "queued"),
    ]);
    const edges = executionEdges(current, state);
    expect(edges.map((edge) => edge.animated)).toEqual([true, true, false, false]);
    expect(edges[0].style?.stroke).toBe("var(--primary)");
    expect(edges[1].label).toBe("IF · 满足条件");
    expect(edges[2].style).toMatchObject({ opacity: 0.35, strokeDasharray: "5 5" });
    expect(current).toEqual(original);
    expect(snapshotGraph({ ...current, edges })).toEqual(snapshotGraph(original));
  });

  it("never animates failed, cancelled, skipped or not-yet-ready paths", () => {
    const current = graph();
    const state = run(
      [node("start", "succeeded"), node("llm", "failed"), node("end", "skipped")],
      "failed",
    );
    const edges = executionEdges(current, state);
    expect(edges.every((edge) => !edge.animated)).toBe(true);
    expect(edges[0].style?.stroke).toBe("var(--destructive)");
    expect(edges[3].style?.strokeDasharray).toBe("5 5");
    expect(
      executionEdges(current, run([node("start", "queued"), node("llm", "running")]))[0].animated,
    ).toBe(false);
    expect(
      executionEdges(
        current,
        run([node("start", "succeeded"), node("llm", "running")], "cancelled"),
      )[0].animated,
    ).toBe(false);
    expect(executionEdges(current, null).every((edge) => !edge.animated)).toBe(true);
    expect(
      executionEdges(
        current,
        run([node("start", "succeeded"), node("llm", "succeeded")], "succeeded"),
      )[0].style?.stroke,
    ).toBe("var(--success)");
  });
});
