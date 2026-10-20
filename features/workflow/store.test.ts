import { beforeEach, describe, expect, it } from "vitest";
import { useWorkflowStore } from "@/features/workflow/store";
import type { WorkflowRun, WorkflowRunChangedEvent } from "@/features/workflow/types";

function runFixture(): WorkflowRun {
  return {
    id: "run-1",
    workflowId: "workflow-1",
    resumedFromRunId: null,
    status: "queued",
    error: null,
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z",
    startedAt: null,
    finishedAt: null,
    nodes: [
      {
        nodeId: "text-1",
        nodeType: "text",
        status: "queued",
        isReused: false,
        progress: null,
        output: null,
        error: null,
        startedAt: null,
        finishedAt: null,
      },
      {
        nodeId: "image-1",
        nodeType: "imageGenerate",
        status: "queued",
        isReused: false,
        progress: null,
        output: null,
        error: null,
        startedAt: null,
        finishedAt: null,
      },
    ],
  };
}

function event(patch: Partial<WorkflowRunChangedEvent> = {}): WorkflowRunChangedEvent {
  return {
    workflowId: "workflow-1",
    runId: "run-1",
    status: "running",
    nodeId: "image-1",
    nodeStatus: "running",
    progress: 0.42,
    output: null,
    error: null,
    ...patch,
  };
}

beforeEach(() => {
  useWorkflowStore.getState().reset();
  useWorkflowStore.getState().setRun(runFixture());
});

describe("workflow realtime progress", () => {
  it("applies a node event immediately while preserving the other steps", () => {
    useWorkflowStore.getState().applyRunEvent(event());

    const run = useWorkflowStore.getState().run;
    expect(run?.status).toBe("running");
    expect(run?.startedAt).not.toBeNull();
    expect(run?.nodes[0].status).toBe("queued");
    expect(run?.nodes[1]).toMatchObject({
      status: "running",
      progress: 0.42,
    });
    expect(run?.nodes[1].startedAt).not.toBeNull();
  });

  it("keeps the realtime output when a step succeeds", () => {
    useWorkflowStore.getState().applyRunEvent(
      event({
        nodeStatus: "succeeded",
        progress: 1,
        output: { images: ["/api/v1/canvas/assets/image-1"] },
      }),
    );

    expect(useWorkflowStore.getState().run?.nodes[1]).toMatchObject({
      status: "succeeded",
      progress: 1,
      output: { images: ["/api/v1/canvas/assets/image-1"] },
    });
    expect(useWorkflowStore.getState().run?.nodes[1].finishedAt).not.toBeNull();
  });

  it("applies terminal run events even when they do not identify a node", () => {
    useWorkflowStore.getState().applyRunEvent(
      event({
        status: "failed",
        nodeId: null,
        nodeStatus: null,
        progress: null,
        error: "generation failed",
      }),
    );

    expect(useWorkflowStore.getState().run).toMatchObject({
      status: "failed",
      error: "generation failed",
    });
    expect(useWorkflowStore.getState().run?.finishedAt).not.toBeNull();
  });

  it("ignores events from another run", () => {
    useWorkflowStore.getState().applyRunEvent(event({ runId: "run-2" }));

    expect(useWorkflowStore.getState().run).toEqual(runFixture());
  });
});

describe("workflow external API bindings", () => {
  it("upserts one binding per node field and removes it with the node", () => {
    const store = useWorkflowStore.getState();
    const nodeId = store.addNode("text", { x: 10, y: 20 });

    store.saveInputBinding({
      key: "prompt",
      label: "Prompt",
      description: "",
      type: "string",
      required: true,
      target: { nodeId, field: "text" },
    });
    store.saveInputBinding({
      key: "scene_prompt",
      label: "Scene prompt",
      description: "",
      type: "string",
      required: true,
      target: { nodeId, field: "text" },
    });

    expect(useWorkflowStore.getState().externalApi.inputs).toHaveLength(1);
    expect(useWorkflowStore.getState().externalApi.inputs[0].key).toBe("scene_prompt");

    useWorkflowStore.getState().onNodesChange([{ id: nodeId, type: "remove" }]);
    expect(useWorkflowStore.getState().externalApi.inputs).toEqual([]);
  });

  it("does not mark React Flow measurement events as document edits", () => {
    const store = useWorkflowStore.getState();
    const nodeId = store.addNode("image", { x: 10, y: 20 });
    const revision = useWorkflowStore.getState().revision;

    useWorkflowStore.getState().onNodesChange([
      {
        id: nodeId,
        type: "dimensions",
        dimensions: { width: 280, height: 260 },
        setAttributes: true,
      },
    ]);

    expect(useWorkflowStore.getState().revision).toBe(revision);
  });
});
