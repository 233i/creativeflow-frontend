import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "./store";
import { loadLocal, stripForStorage } from "./persistence";
import {
  detachImageJobs,
  queryImageJob,
  regenerateImageJob,
  resumeImageJobs,
  retryImageDownload,
  startImageJob,
} from "./image-jobs";
import type { ImageJobInput, ImageJobResponse } from "./image-job-types";
import type { ImageNodeData } from "./types";

const input: ImageJobInput = {
  providerId: "provider",
  modelKey: "model",
  prompt: "original tree",
  images: [],
  count: 1,
  nodeId: "g",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const response = (
  status: ImageJobResponse["status"] = "queued",
  id = "job-1",
): ImageJobResponse => ({
  jobId: id,
  input,
  status,
  createdAt: "2026-09-06T04:00:00Z",
  canRetryDownload: status === "failed",
  finishedAt: status === "failed" || status === "succeeded" ? "2026-09-06T04:01:00Z" : null,
  nodeId: "g",
  assets:
    status === "succeeded"
      ? [{ index: 0, assetId: id, url: `/api/v1/canvas/assets/${id}`, mediaType: "image/png" }]
      : [],
});
const images = () => useCanvasStore.getState().nodes.filter((node) => node.type === "image");
const data = (index = 0) => images()[index].data as ImageNodeData;
const start = () => startImageJob("g", input, "model-config");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-06T04:00:10Z"));
  localStorage.clear();
  useCanvasStore.getState().reset();
  useCanvasStore
    .getState()
    .load(
      { nodes: [{ id: "g", type: "imageGen", position: { x: 0, y: 0 }, data: {} }], edges: [] },
      crypto.randomUUID(),
    );
});
afterEach(() => {
  detachImageJobs();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("persistent canvas image jobs", () => {
  it("persists its idempotency key before POST and returns without waiting for generation", async () => {
    const fetchMock = vi.fn().mockImplementation((_url, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const cached = loadLocal(useCanvasStore.getState().canvasId!)!;
      expect((cached.nodes[1].data as ImageNodeData).imageJob?.key).toBe(body.key);
      expect(body.input.prompt).toBe("original tree");
      return Promise.resolve(json(response(), 202));
    });
    vi.stubGlobal("fetch", fetchMock);
    await start();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(data().jobId).toBe("job-1");
    expect(data().execution?.status).toBe("queued");
    expect(data().execution?.startedAt).toBe(Date.parse(response().createdAt));
  });

  it("shows real queued, generating and saving stages, then fills the same output node", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(response(), 202))
      .mockResolvedValueOnce(json(response("generating")))
      .mockResolvedValueOnce(json(response("saving")))
      .mockResolvedValueOnce(json(response("succeeded")));
    vi.stubGlobal("fetch", fetchMock);
    await start();
    const nodeId = images()[0].id;
    await vi.advanceTimersByTimeAsync(3000);
    expect(data().execution?.phase).toBe("generating");
    await vi.advanceTimersByTimeAsync(3000);
    expect(data().execution?.phase).toBe("saving");
    await vi.advanceTimersByTimeAsync(3000);
    expect(data().execution?.status).toBe("succeeded");
    expect(images()[0].id).toBe(nodeId);
    expect(data().assetUrl).toBe("/api/v1/canvas/assets/job-1");
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === "POST")).toHaveLength(1);
  });

  it("treats a polling disconnect as unknown, not as a failed generation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(response(), 202))
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(json(response("succeeded")));
    vi.stubGlobal("fetch", fetchMock);
    await start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(data().imageJob?.connectionLost).toBe(true);
    expect(data().execution?.status).toBe("queued");
    await queryImageJob(images()[0].id);
    expect(data().execution?.status).toBe("succeeded");
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === "POST")).toHaveLength(1);
  });

  it("recovers a lost 202 using a read-only key lookup without resubmitting", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: "gateway" }, 502))
      .mockResolvedValueOnce(json(response("succeeded")));
    vi.stubGlobal("fetch", fetchMock);
    await start();
    expect(data().jobId).toBeUndefined();
    expect(data().imageJob?.connectionLost).toBe(true);
    const key = data().imageJob!.key;
    await queryImageJob(images()[0].id);
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/v1/ai/image-jobs/by-submission/${key}`);
    expect(fetchMock.mock.calls[1][1].method).toBe("GET");
    expect(data().jobId).toBe("job-1");
  });

  it("marks a rejected submission as failed instead of claiming it continues in the background", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: "Queue full" }, 429)));
    await start();
    expect(data().jobId).toBeUndefined();
    expect(data().execution).toMatchObject({ status: "failed", error: "Queue full" });
    expect(data().execution?.phase).toBeUndefined();
    expect(data().imageJob).toMatchObject({ status: "failed", connectionLost: false });
  });

  it("keeps polling an active job after a manual query has a network error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(response(), 202))
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(json(response("succeeded")));
    vi.stubGlobal("fetch", fetchMock);
    await start();
    await expect(queryImageJob(images()[0].id)).rejects.toThrow("offline");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(data().execution?.status).toBe("succeeded");
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === "POST")).toHaveLength(1);
  });

  it("recovers a lost retry-download response by GET without repeating either POST", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(response("failed"), 202))
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(json(response("succeeded")));
    vi.stubGlobal("fetch", fetchMock);
    await start();
    await expect(retryImageDownload(images()[0].id)).rejects.toThrow("offline");
    expect(data().imageJob?.connectionLost).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(data().execution?.status).toBe("succeeded");
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ["/api/v1/ai/image-jobs", "POST"],
      ["/api/v1/ai/image-jobs/job-1/retry-download", "POST"],
      ["/api/v1/ai/image-jobs/job-1", "GET"],
    ]);
  });

  it("restores pending work after reload without making another POST", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(response(), 202));
    vi.stubGlobal("fetch", fetchMock);
    await start();
    detachImageJobs();
    const state = useCanvasStore.getState();
    state.load({ nodes: stripForStorage(state.nodes), edges: state.edges }, state.canvasId!);
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("?canvasId=")
          ? json({ items: [], nextCursor: null })
          : json(response("succeeded")),
      ),
    );
    await resumeImageJobs(state.canvasId!, Date.now());
    expect(data().execution?.status).toBe("succeeded");
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === "POST")).toHaveLength(1);
  });

  it("does not apply a late submission response to a different canvas", async () => {
    let release!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      ),
    );
    const pending = start();
    useCanvasStore
      .getState()
      .load(
        { nodes: [{ id: "g", type: "imageGen", position: { x: 0, y: 0 }, data: {} }], edges: [] },
        "other-canvas",
      );
    release(json(response(), 202));
    await pending;
    expect(images()).toHaveLength(0);
  });

  it("download recovery only posts to retry-download and retains the original job", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(response("failed"), 202))
      .mockResolvedValueOnce(json(response("saving"), 202))
      .mockResolvedValueOnce(json(response("succeeded")));
    vi.stubGlobal("fetch", fetchMock);
    await start();
    await retryImageDownload(images()[0].id);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/ai/image-jobs/job-1/retry-download");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({});
    await vi.advanceTimersByTimeAsync(3000);
    expect(data().jobId).toBe("job-1");
    expect(data().execution?.status).toBe("succeeded");
    expect(images()).toHaveLength(1);
  });

  it("regeneration preserves the original result and uses the immutable snapshot", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(response("succeeded"), 202))
      .mockResolvedValueOnce(json(response("queued", "job-2"), 202));
    vi.stubGlobal("fetch", fetchMock);
    await start();
    const originalNode = images()[0].id;
    const oldKey = data().imageJob!.key;
    useCanvasStore.getState().updateNodeData("g", { prompt: "changed", count: 4 });
    await regenerateImageJob(originalNode);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/ai/image-jobs/job-1/regenerate");
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(Object.keys(body)).toEqual(["key"]);
    expect(body.key).not.toBe(oldKey);
    expect(images()).toHaveLength(2);
    expect(data().assetUrl).toBe("/api/v1/canvas/assets/job-1");
    expect(data(1).imageJob!.input.prompt).toBe("original tree");
  });

  it("collapses server-deduplicated batches instead of displaying duplicate placeholders", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(json(response(), 202))),
    );
    await start();
    await start();
    expect(images()).toHaveLength(1);
  });

  it("recovers new accepted jobs but does not resurrect old deleted results", async () => {
    const oldJob = { ...response("succeeded", "old"), createdAt: "2026-09-06T03:00:00Z" };
    const newJob = { ...response("succeeded", "new"), createdAt: "2026-09-06T04:00:20Z" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ items: [newJob, oldJob], nextCursor: null })),
    );
    await resumeImageJobs(useCanvasStore.getState().canvasId!, Date.now());
    expect(images()).toHaveLength(1);
    expect(data().jobId).toBe("new");
  });
});
