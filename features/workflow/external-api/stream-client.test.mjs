import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEvents, workflowEvents } from "../../../public/examples/workflow-stream.mjs";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const delta = (id, text) =>
  `id: run:${id}\nevent: output.delta\ndata: ${JSON.stringify({ output: "answer", path: "", delta: text, provisional: true })}\n\n`;
const done = 'event: run.completed\ndata: {"outputs":{"answer":"你好"}}\n\n';
const response = (text) => new Response(text, { headers: { "Content-Type": "text/event-stream" } });

describe("downloadable SSE client", () => {
  it("parses UTF-8 and CRLF split at every byte without confirming incomplete frames", async () => {
    const bytes = new TextEncoder().encode(
      ": heartbeat\r\n\r\n" +
        (delta(1, "你好😀") + done).replaceAll("\n", "\r\n") +
        'id: run:99\nevent: output.delta\ndata: {"delta":"unfinished"}',
    );
    const body = new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    });
    const result = [];
    for await (const event of parseEvents(body.getReader())) result.push(event);
    expect(result).toHaveLength(2);
    expect(result[0].data.delta).toBe("你好😀");
    expect(result[0].id).toBe("run:1");
    expect(result[1].event).toBe("run.completed");
    expect(result[1].id).toBeUndefined();
  });

  it("reconnects to the same run with the acknowledged id and stops on terminal output", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(delta(1, "你")))
      .mockResolvedValueOnce(response(delta(2, "好") + done));
    vi.stubGlobal("fetch", fetch);
    const stream = workflowEvents("https://example.test/events", "synthetic");
    expect((await stream.next()).value.data.delta).toBe("你");
    const second = stream.next();
    await vi.advanceTimersByTimeAsync(1000);
    expect((await second).value.data.delta).toBe("好");
    expect(fetch.mock.calls[1][0]).toBe("https://example.test/events");
    expect(fetch.mock.calls[1][1].headers["Last-Event-ID"]).toBe("run:1");
    expect((await stream.next()).value.event).toBe("run.completed");
    expect((await stream.next()).done).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403, 404, 400])("does not retry HTTP %s or create a new task", async (status) => {
    const fetch = vi.fn().mockResolvedValue(new Response("denied", { status }));
    vi.stubGlobal("fetch", fetch);
    await expect(workflowEvents("https://example.test/events", "synthetic").next()).rejects.toThrow(
      `HTTP ${status}`,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("stops immediately when a resource grant is revoked mid-stream", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        response('event: stream.error\ndata: {"message":"撤权","retryable":false}\n\n'),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(workflowEvents("https://example.test/events", "synthetic").next()).rejects.toThrow(
      "撤权",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending reconnect when the consumer aborts", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetch = vi.fn().mockResolvedValue(response(""));
    vi.stubGlobal("fetch", fetch);
    const pending = workflowEvents("https://example.test/events", "synthetic", {
      signal: controller.signal,
    }).next();
    const rejected = expect(pending).rejects.toThrow("stop");
    await vi.advanceTimersByTimeAsync(1);
    controller.abort(new Error("stop"));
    await rejected;
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
