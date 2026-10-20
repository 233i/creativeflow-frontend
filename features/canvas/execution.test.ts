import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasEdge, CanvasNode } from "@/features/canvas/store";

const aiState = vi.hoisted(() => ({
  providers: [
    {
      id: "p1",
      enabled: true,
      models: [{ id: "m1", modelKey: "some-image-model", enabled: true }],
    },
  ],
}));

// 执行逻辑只需从 AI 状态仓库获取提供商；画布状态仓库保留真实实现，
// 因为这些测试关注最终写入图中的内容。
vi.mock("@/features/ai/store", () => ({
  useAiStore: {
    getState: () => aiState,
  },
}));

const { useCanvasStore } = await import("@/features/canvas/store");
const { cancelRun, retryRun, runImageNode, runVideoNode, resumeVideoJobs } =
  await import("@/features/canvas/execution");
const { detachImageJobs } = await import("@/features/canvas/image-jobs");
afterEach(() => detachImageJobs());

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function node(id: string, type: string, data: Record<string, unknown>): CanvasNode {
  return { id, type, position: { x: 0, y: 0 }, data } as CanvasNode;
}

function edge(source: string, target: string): CanvasEdge {
  return { id: `e${source}-${target}`, source, target };
}

/** 使用状态仓库中的当前图运行图片节点，与节点自身按钮的行为一致。 */
async function run(nodeId: string) {
  const { nodes, edges } = useCanvasStore.getState();
  await runImageNode(nodeId, nodes, edges);
}

function imageNodes() {
  return useCanvasStore.getState().nodes.filter((candidate) => candidate.type === "image");
}

function executionOf(nodeId: string) {
  const found = useCanvasStore.getState().nodes.find((candidate) => candidate.id === nodeId);
  return (found?.data as { execution?: { status: string; error?: string; runId: string } })
    ?.execution;
}

/** 一个不会自行结束的 fetch，但被中止时会像真实请求一样拒绝。 */
function abortableFetch() {
  return vi.fn().mockImplementation(
    (_input: string, init?: { signal?: AbortSignal }) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
  );
}

function assets(...urls: string[]) {
  return {
    jobId: crypto.randomUUID(),
    status: "succeeded",
    canRetryDownload: false,
    createdAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    input: {
      providerId: "p1",
      modelKey: "some-image-model",
      prompt: "a cat",
      images: [],
      count: urls.length || 1,
      nodeId: "g",
    },
    assets: urls.map((url, index) => ({
      index,
      url,
      mediaType: "image/png",
      assetId: String(index),
    })),
  };
}

beforeEach(() => {
  useCanvasStore.getState().reset();
  useCanvasStore.setState({ canvasId: crypto.randomUUID() });
  aiState.providers[0].enabled = true;
  aiState.providers[0].models[0].enabled = true;
  vi.restoreAllMocks();
});

describe("cancelRun", () => {
  it("stops the upstream job using the id held by the node it was pressed on", async () => {
    // 任务 ID 保存在输出节点上，“停止”按钮也位于该节点。若视频只在本地停止，
    // 上游仍会继续渲染并持续计费。
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    useCanvasStore.getState().load({
      nodes: [
        node("g", "videoGen", {}),
        node("v", "video", { jobId: "job-42", execution: { runId: "r1", status: "running" } }),
      ],
      edges: [edge("g", "v")],
    });

    cancelRun("v");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/ai/videos/job-42",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("takes the node out of its running state", () => {
    // 本应更新结果的轮询器刚刚已解除，若不处理，节点会永远显示加载状态。
    // 节点本身仍保留：上游确实接受过任务，值得展示。
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({})));

    useCanvasStore.getState().load({
      nodes: [
        node("g", "videoGen", {}),
        node("v", "video", { jobId: "job-42", execution: { runId: "r1", status: "running" } }),
      ],
      edges: [edge("g", "v")],
    });

    cancelRun("v");

    expect(executionOf("v")?.status).toBe("cancelled");
    expect(executionOf("g")).toBeUndefined();
  });

  it("stops every node of the run, not just the one that was clicked", () => {
    // 一次请求会产生此次运行的全部图片，因此停止其中一个会停止全部结果节点。
    vi.stubGlobal("fetch", vi.fn());

    useCanvasStore.getState().load({
      nodes: [
        node("g", "imageGen", {}),
        node("a", "image", { assetUrl: "/a", execution: { runId: "r1", status: "running" } }),
        node("b", "image", { assetUrl: "/b", execution: { runId: "r1", status: "running" } }),
        node("c", "image", { assetUrl: "/c", execution: { runId: "r2", status: "running" } }),
      ],
      edges: [edge("g", "a"), edge("g", "b"), edge("g", "c")],
    });

    cancelRun("a");

    expect(executionOf("a")?.status).toBe("cancelled");
    expect(executionOf("b")?.status).toBe("cancelled");
    // 同一配置节点发起的并发任务不受影响。
    expect(executionOf("c")?.status).toBe("running");
  });
});

describe("a run in progress", () => {
  beforeEach(() => {
    useCanvasStore.getState().load({
      nodes: [
        node("t", "text", { text: "a cat" }),
        node("g", "imageGen", { providerId: "p1", modelId: "m1", count: 2 }),
      ],
      edges: [edge("t", "g")],
    });
  });

  it("puts its output nodes on the canvas before the request resolves", async () => {
    // 生成需要数十秒。若只在成功后创建节点，期间画布会毫无变化，用户会以为点击完全没有生效。
    let release: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    const finished = run("g");

    expect(imageNodes()).toHaveLength(2);
    expect(imageNodes().map((candidate) => executionOf(candidate.id)?.status)).toEqual([
      "queued",
      "queued",
    ]);

    release(jsonResponse(assets("/api/v1/canvas/assets/1", "/api/v1/canvas/assets/2")));
    await finished;

    // 原地填充而非替换：结果会落在用户一直关注的框中。
    expect(imageNodes()).toHaveLength(2);
    expect(
      imageNodes().map((candidate) => (candidate.data as { assetUrl?: string }).assetUrl),
    ).toEqual(["/api/v1/canvas/assets/1", "/api/v1/canvas/assets/2"]);
    expect(
      imageNodes().every((candidate) => executionOf(candidate.id)?.status === "succeeded"),
    ).toBe(true);
  });

  it("leaves the run state off the config node", async () => {
    // 过去由配置节点持有运行状态，导致无法再次生成：新任务会接管首次任务用于校验的状态字段。
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(assets("/one"))));

    await run("g");

    expect(executionOf("g")).toBeUndefined();
  });

  it("reports a failed request on the node that was waiting for the image", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "nope" }, 400)));

    await run("g");

    // 明确的输入拒绝保留提交快照，便于查询与用户确认后重新提交。
    expect(imageNodes()).toHaveLength(2);
    expect(executionOf(imageNodes()[0].id)?.status).toBe("failed");
    expect(executionOf(imageNodes()[0].id)?.error).toBe("nope");
    expect(executionOf("g")).toBeUndefined();
  });

  it("discards the spares when fewer images come back than were asked for", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(assets("/api/v1/canvas/assets/1"))),
    );

    await run("g");

    expect(imageNodes()).toHaveLength(1);
    expect((imageNodes()[0].data as { assetUrl?: string }).assetUrl).toBe(
      "/api/v1/canvas/assets/1",
    );
  });

  it("does not pretend an accepted image task was cancelled by a browser action", async () => {
    const response = { ...assets(), status: "queued", finishedAt: null };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response, 202));
    vi.stubGlobal("fetch", fetchMock);
    await run("g");
    cancelRun(imageNodes()[0].id);
    expect(imageNodes()).toHaveLength(2);
    expect(executionOf(imageNodes()[0].id)?.status).toBe("queued");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports nothing connected upstream on the config node", async () => {
    useCanvasStore.getState().load({
      nodes: [node("g", "imageGen", { providerId: "p1", modelId: "m1" })],
      edges: [],
    });

    await run("g");

    // 此时尚未创建节点，因此只能在配置节点上显示该信息。
    expect(imageNodes()).toHaveLength(0);
    expect(executionOf("g")?.status).toBe("failed");
  });

  it("refuses a model disabled by an administrator before sending a request", async () => {
    aiState.providers[0].models[0].enabled = false;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await run("g");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(imageNodes()).toHaveLength(0);
    expect(executionOf("g")?.status).toBe("failed");
    expect(executionOf("g")?.error).toContain("disabled");
  });

  it("clears a previous failure when it starts", async () => {
    // 现在只有预检失败会走到这里；这是唯一没有独立节点可承载错误的失败类型。
    useCanvasStore.getState().load({
      nodes: [node("g", "imageGen", { providerId: "p1", modelId: "m1" })],
      edges: [],
    });
    await run("g");
    expect(executionOf("g")?.status).toBe("failed");

    useCanvasStore.getState().load({
      nodes: [
        node("t", "text", { text: "a cat" }),
        node("g", "imageGen", { providerId: "p1", modelId: "m1", execution: executionOf("g") }),
      ],
      edges: [edge("t", "g")],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(assets("/one"))));
    await run("g");

    // 新尝试不应在开始时仍显示旧错误。
    expect(executionOf("g")).toBeUndefined();
  });
});

describe("the image request body", () => {
  it("associates generation with the active canvas and node", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(assets("/one")));
    vi.stubGlobal("fetch", fetchMock);
    useCanvasStore.getState().load(
      {
        nodes: [
          node("t", "text", { text: "a cat" }),
          node("g", "imageGen", { providerId: "p1", modelId: "m1" }),
        ],
        edges: [edge("t", "g")],
      },
      "canvas-image",
    );
    await run("g");
    expect(bodyOf(fetchMock)).toMatchObject({
      canvasId: "canvas-image",
      nodeId: "g",
      prompt: "a cat",
    });
  });
  /** 从 fetch 模拟实现中取出已提交的 JSON。 */
  function bodyOf(fetchMock: ReturnType<typeof vi.fn>) {
    const call = fetchMock.mock.calls.find(([url]) => url === "/api/v1/ai/image-jobs");
    return JSON.parse((call?.[1] as { body: string }).body).input;
  }

  function graph(config: Record<string, unknown>) {
    useCanvasStore.getState().load({
      nodes: [
        node("t", "text", { text: "a cat" }),
        node("g", "imageGen", { providerId: "p1", modelId: "m1", ...config }),
      ],
      edges: [edge("t", "g")],
    });
  }

  it("sends a marked inpaint mask separately from reference images", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(assets("/one")));
    vi.stubGlobal("fetch", fetchMock);
    useCanvasStore.getState().load({
      nodes: [
        node("t", "text", { text: "repair the painted area" }),
        node("source", "image", { assetUrl: "/source.png" }),
        node("mask", "image", { assetUrl: "/mask.png", role: "inpaint-mask" }),
        node("g", "imageGen", { providerId: "p1", modelId: "m1" }),
      ],
      edges: [edge("t", "g"), edge("source", "g"), edge("mask", "g")],
    });

    await run("g");

    expect(bodyOf(fetchMock)).toMatchObject({
      maskUrl: "/mask.png",
      images: ["/source.png"],
    });
    expect(bodyOf(fetchMock).images).not.toContain("/mask.png");
  });

  it("asks for a PNG but leaves the administrator-owned response type out", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(assets("/one")));
    vi.stubGlobal("fetch", fetchMock);
    graph({});

    await run("g");

    expect(bodyOf(fetchMock)).toMatchObject({ outputFormat: "png" });
    expect(bodyOf(fetchMock)).not.toHaveProperty("responseFormat");
  });

  it("sends the chosen output format and quality", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(assets("/one")));
    vi.stubGlobal("fetch", fetchMock);
    graph({ outputFormat: "jpeg", quality: "high" });

    await run("g");

    expect(bodyOf(fetchMock)).toMatchObject({
      outputFormat: "jpeg",
      quality: "high",
    });
    expect(bodyOf(fetchMock)).not.toHaveProperty("responseFormat");
  });
});

describe("the video duration request", () => {
  it("associates asynchronous video requests with the active canvas and node", async () => {
    const fetchMock = abortableFetch();
    vi.stubGlobal("fetch", fetchMock);
    graph();
    useCanvasStore.setState({ canvasId: "canvas-video" });
    expect(await startAndCancel(fetchMock)).toMatchObject({
      canvasId: "canvas-video",
      nodeId: "g",
    });
  });
  function graph(duration?: number, seedanceInputMode?: string) {
    useCanvasStore.getState().load({
      nodes: [
        node("t", "text", { text: "a cat" }),
        node("g", "videoGen", {
          providerId: "p1",
          modelId: "m1",
          duration,
          seedanceInputMode,
        }),
      ],
      edges: [edge("t", "g")],
    });
  }

  function videoNodes() {
    return useCanvasStore.getState().nodes.filter((candidate) => candidate.type === "video");
  }

  function postedBody(fetchMock: ReturnType<typeof vi.fn>) {
    const call = fetchMock.mock.calls.find(([url]) => url === "/api/v1/ai/videos");
    return JSON.parse((call?.[1] as { body: string }).body);
  }

  async function startAndCancel(fetchMock: ReturnType<typeof vi.fn>) {
    const { nodes, edges } = useCanvasStore.getState();
    const running = runVideoNode("g", nodes, edges);

    const [output] = videoNodes();
    cancelRun(output.id);
    await running;

    return postedBody(fetchMock);
  }

  it("sends the five-second default when duration is absent", async () => {
    const fetchMock = abortableFetch();
    vi.stubGlobal("fetch", fetchMock);
    graph();

    expect((await startAndCancel(fetchMock)).duration).toBe(5);
  });

  it("sends an arbitrary whole number in range", async () => {
    const fetchMock = abortableFetch();
    vi.stubGlobal("fetch", fetchMock);
    graph(12);

    expect((await startAndCancel(fetchMock)).duration).toBe(12);
  });

  it("defaults to reference media and sends the selected first/last mode", async () => {
    const fetchMock = abortableFetch();
    vi.stubGlobal("fetch", fetchMock);
    graph(5, "first-last");

    expect((await startAndCancel(fetchMock)).inputMode).toBe("first-last");
  });

  it.each([0, 16, 3.5])(
    "rejects invalid stored duration %s before calling the API",
    async (duration) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      graph(duration);

      const { nodes, edges } = useCanvasStore.getState();
      await runVideoNode("g", nodes, edges);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(videoNodes()).toHaveLength(0);
      expect(executionOf("g")?.status).toBe("failed");
      expect(executionOf("g")?.error).toContain("1 to 15");
    },
  );
});

describe("retrying from a failed node", () => {
  beforeEach(() => {
    useCanvasStore.getState().load({
      nodes: [
        node("t", "text", { text: "a cat" }),
        node("g", "imageGen", { providerId: "p1", modelId: "m1" }),
      ],
      edges: [edge("t", "g")],
    });
  });

  it("replaces the failed node with a fresh run of the node that fed it", async () => {
    // 旧同步任务仍可使用原重试入口；新任务只用独立的安全恢复操作。
    const failed = useCanvasStore.getState().spawnOutput("g", "image", {
      execution: { runId: "legacy", status: "failed" },
    })!;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(assets("/second-time"))));

    const { nodes, edges } = useCanvasStore.getState();
    retryRun(failed, nodes, edges);

    // retryRun 会像按钮一样启动新任务但不等待其完成。
    await vi.waitFor(() =>
      expect((imageNodes()[0]?.data as { assetUrl?: string }).assetUrl).toBe("/second-time"),
    );

    // 红色错误框会被移除，而不是堆积在替代节点旁；重试会经过配置节点，
    // 因此能读取此后发生的所有设置变化。
    expect(imageNodes()).toHaveLength(1);
    expect(imageNodes().map((candidate) => candidate.id)).not.toContain(failed);
  });

  it("does nothing for a node no generation node feeds", () => {
    // 上传的图片背后没有生成任务，因此没有可重试的内容。
    useCanvasStore.getState().load({
      nodes: [node("i", "image", { assetUrl: "/uploaded" })],
      edges: [],
    });

    const { nodes, edges } = useCanvasStore.getState();
    retryRun("i", nodes, edges);

    expect(imageNodes()).toHaveLength(1);
  });
});

describe("submitting another image task", () => {
  it("never sends an image task to the video recovery endpoint on reload", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const image = node("image-job", "image", {
      jobId: "image-task",
      execution: { runId: "image-only", status: "running" },
    });
    useCanvasStore.getState().load({ nodes: [image], edges: [] });
    try {
      resumeVideoJobs([image]);
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
  beforeEach(() => {
    useCanvasStore.getState().load({
      nodes: [
        node("t", "text", { text: "a cat" }),
        node("g", "imageGen", { providerId: "p1", modelId: "m1" }),
      ],
      edges: [edge("t", "g")],
    });
  });

  it("coalesces a double click before the task ID arrives", async () => {
    let release!: (value: Response) => void;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const first = run("g");
    const second = run("g");
    expect(imageNodes()).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release(jsonResponse(assets("/first")));
    await Promise.all([first, second]);
    expect((imageNodes()[0].data as { assetUrl: string }).assetUrl).toBe("/first");
  });

  it("places a later explicitly submitted batch below the accepted batch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          jsonResponse(
            {
              ...assets(),
              status: "queued",
              finishedAt: null,
            },
            202,
          ),
        ),
      ),
    );
    await run("g");
    await run("g");
    const [first, second] = imageNodes();
    expect(second.position.y).toBeGreaterThan(first.position.y);
    expect(second.position.x).toBe(first.position.x);
  });

  it("does not let the legacy retry entry point regenerate a persistent image task", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(assets("/one")));
    vi.stubGlobal("fetch", fetchMock);
    await run("g");
    const { nodes, edges } = useCanvasStore.getState();
    await retryRun(imageNodes()[0].id, nodes, edges);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(imageNodes()).toHaveLength(1);
  });
});
