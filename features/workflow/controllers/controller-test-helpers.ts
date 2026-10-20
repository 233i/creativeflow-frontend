import { vi } from "vitest";
import { createWorkflowApiClient, type WorkflowDocument } from "../api";
import type { WorkflowGraph, WorkflowRun } from "../types";
import { createV2Workflow } from "../v2/types";

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

export function controllerFixture(graph: WorkflowGraph = createV2Workflow()) {
  const time = "2026-09-27T08:00:00Z";
  const document: WorkflowDocument = {
    id: "workflow",
    name: "Controller fixture",
    schemaVersion: 1,
    graph,
    createdAt: time,
    updatedAt: time,
  };
  const run: WorkflowRun = {
    id: "run",
    workflowId: document.id,
    status: "running",
    resumedFromRunId: null,
    createdAt: time,
    updatedAt: time,
    startedAt: time,
    finishedAt: null,
    error: null,
    nodes: graph.nodes.map((node) => ({
      nodeId: node.id,
      nodeType: node.type as WorkflowRun["nodes"][number]["nodeType"],
      status: "running",
      isReused: false,
      progress: null,
      output: null,
      error: null,
      startedAt: time,
      finishedAt: null,
    })),
  };
  const client = {
    ...createWorkflowApiClient(),
    getWorkflow: vi.fn().mockResolvedValue(document),
    saveWorkflow: vi
      .fn()
      .mockImplementation(async (_id: string, savedGraph: WorkflowGraph, name?: string) => ({
        ...document,
        graph: savedGraph,
        name: name ?? document.name,
      })),
    getWorkflowRun: vi.fn().mockResolvedValue(run),
    getLatestWorkflowRun: vi.fn().mockResolvedValue(run),
    listWorkflowRuns: vi.fn().mockResolvedValue({ runs: [] }),
    getWorkflowRunSnapshot: vi.fn().mockResolvedValue({ runId: run.id, graph }),
    startWorkflowRun: vi.fn().mockResolvedValue(run),
    resumeWorkflowRun: vi.fn().mockResolvedValue({ ...run, id: "resumed" }),
    partialRerunWorkflow: vi.fn().mockResolvedValue({ ...run, id: "partial" }),
    previewPartialWorkflowRerun: vi
      .fn()
      .mockImplementation(async (_workflow: string, sourceRunId: string, fromNodeId: string) => ({
        sourceRunId,
        fromNodeId,
        rerunNodeIds: [fromNodeId],
        reusedNodeIds: [],
      })),
    cancelWorkflowRun: vi.fn().mockResolvedValue(undefined),
    startNodeDebug: vi
      .fn()
      .mockResolvedValue({ ...run, id: "debug", debugNodeId: graph.nodes[1]?.id }),
    getNodeDebugInputs: vi.fn().mockResolvedValue({ inputs: {}, readonlyFields: [] }),
    getWorkflowCapabilities: vi
      .fn()
      .mockResolvedValue({ enabled: true, nodeTypes: ["start", "llm", "end"] }),
  };
  return { graph, document, run, client };
}
