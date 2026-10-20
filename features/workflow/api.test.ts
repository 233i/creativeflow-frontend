import { beforeEach, describe, expect, it, vi } from "vitest";
import { partialRerunWorkflow, previewPartialWorkflowRerun } from "@/features/workflow/api";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("workflow partial rerun API", () => {
  it("requests a server-calculated dependency preview", async () => {
    const preview = {
      sourceRunId: "run-1",
      fromNodeId: "generate/video",
      reusedNodeIds: ["prompt"],
      rerunNodeIds: ["generate/video", "output"],
    };
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(preview));

    await expect(
      previewPartialWorkflowRerun("workflow-1", "run-1", "generate/video"),
    ).resolves.toEqual(preview);

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/workflows/workflow-1/runs/run-1/partial-rerun/preview?fromNodeId=generate%2Fvideo",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("starts the partial rerun from the confirmed node", async () => {
    const run = { id: "run-2", status: "queued", nodes: [] };
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(run));

    await expect(partialRerunWorkflow("workflow-1", "run-1", "video-1")).resolves.toEqual(run);

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/workflows/workflow-1/runs/run-1/partial-rerun",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ fromNodeId: "video-1" }),
      }),
    );
  });
});
