import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "@/features/canvas/store";
import type { AgentToolCallEnvelope } from "./types";

const recovery = vi.hoisted(() => ({ queryImageJob: vi.fn(), retryImageDownload: vi.fn() }));
vi.mock("@/features/canvas/image-jobs", () => recovery);
vi.mock("@/features/ai/store", () => ({
  useAiStore: {
    getState: () => ({
      providers: [
        {
          id: "provider",
          enabled: true,
          models: [{ id: "model", enabled: true, category: "image" }],
        },
      ],
    }),
  },
}));
vi.mock("@/features/canvas/execution", () => ({
  cancelRun: vi.fn(),
  retryRun: vi.fn(),
  runVideoNode: vi.fn(),
  runImageNode: async (id: string) => {
    const { useCanvasStore } = await import("@/features/canvas/store");
    useCanvasStore.getState().spawnOutput(id, "image", {
      jobId: "accepted-job",
      execution: { runId: "run", status: "queued" },
    });
  },
}));
const { executeCanvasTool } = await import("./tools");

function call(toolName: string, input: Record<string, unknown>): AgentToolCallEnvelope {
  return {
    runId: "run",
    canvasId: "canvas",
    toolUseId: toolName,
    toolName,
    inputJson: JSON.stringify(input),
    timeoutMilliseconds: 30000,
  };
}

beforeEach(() => {
  useCanvasStore.getState().reset();
  Object.values(recovery).forEach((action) => action.mockReset().mockResolvedValue(undefined));
});

describe("Agent compatibility with persistent image jobs", () => {
  it.each([false, true])(
    "retry only queries or resumes downloading, recoverable=%s",
    async (canRetryDownload) => {
      const nodeId = useCanvasStore.getState().addNode(
        "image",
        { x: 0, y: 0 },
        {
          jobId: "job",
          imageJob: {
            key: "key",
            index: 0,
            canRetryDownload,
            input: {
              providerId: "provider",
              modelKey: "model",
              prompt: "tree",
              images: [],
              count: 1,
            },
          },
          execution: { runId: "run", status: "failed" },
        },
      );
      const result = await executeCanvasTool(call("retry_node", { nodeId }));
      expect(result.isError).toBe(false);
      expect(JSON.parse(result.json)).toMatchObject({
        regenerated: false,
        operation: canRetryDownload ? "retry_download" : "query_result",
      });
      expect(
        canRetryDownload ? recovery.retryImageDownload : recovery.queryImageJob,
      ).toHaveBeenCalledWith(nodeId);
    },
  );

  it("does not report background image work as cancelled", async () => {
    const nodeId = useCanvasStore.getState().addNode(
      "image",
      { x: 0, y: 0 },
      {
        jobId: "job",
        imageJob: {
          key: "key",
          index: 0,
          input: {
            providerId: "provider",
            modelKey: "model",
            prompt: "tree",
            images: [],
            count: 1,
          },
        },
        execution: { runId: "run", status: "running" },
      },
    );
    const result = await executeCanvasTool(call("cancel_node", { nodeId }));
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.json).error).toContain("cannot_be_cancelled");
  });

  it("does not mistake an accepted image-edit task for a failed generation", async () => {
    const nodeId = useCanvasStore
      .getState()
      .addNode("image", { x: 0, y: 0 }, { assetUrl: "/api/v1/canvas/assets/source" });
    const result = await executeCanvasTool(
      call("edit_image", {
        nodeId,
        operation: "variation",
        providerId: "provider",
        modelId: "model",
        prompt: "tree",
      }),
    );
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.json).outputs[0]).toMatchObject({
      jobId: "accepted-job",
      assetUrl: null,
      execution: { status: "queued" },
    });
  });
});
