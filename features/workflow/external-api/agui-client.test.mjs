import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelWorkflowAgUi,
  readAgUiEvents,
  runWorkflowAgUi,
} from "../../../public/examples/workflow-agui.mjs";

afterEach(() => vi.useRealTimers());
const frame = (id, event) => `id: internal:${id}\ndata: ${JSON.stringify(event)}\n\n`;
const response = (text) => new Response(text, { headers: { "Content-Type": "text/event-stream" } });
const accepted = frame("1:2", {
  type: "CUSTOM",
  name: "workflow.accepted",
  value: { internalRunId: "internal" },
});
const start = frame("1:1", { type: "RUN_STARTED", threadId: "thread", runId: "turn" });
const delta = frame("2:2", { type: "TEXT_MESSAGE_CONTENT", messageId: "message", delta: "你好😀" });
const done = frame("3:2", {
  type: "RUN_FINISHED",
  runId: "turn",
  threadId: "thread",
  result: { answer: "你好😀" },
  outcome: { type: "success" },
});
const options = {
  baseUrl: "https://example.test",
  workflowId: "workflow",
  apiKey: "synthetic",
  inputs: { question: "test" },
  threadId: "thread",
  runId: "turn",
  retryDelayMs: 0,
};

describe("AG-UI downloadable workflow client", () => {
  it("parses split UTF-8, CRLF, comments and multi-line data without acknowledging partial frames", async () => {
    const bytes = new TextEncoder().encode(
      ": heartbeat\r\n\r\n" +
        delta.replaceAll("\n", "\r\n") +
        'id: internal:99:1\ndata: {"type":"unfinished"}',
    );
    const body = new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    });
    const result = [];
    for await (const item of readAgUiEvents(body)) result.push(item);
    expect(result).toHaveLength(1);
    expect(result[0].event.delta).toBe("你好😀");
    expect(result[0].id).toBe("internal:2:2");
    const multiline = response('id: internal:1:1\ndata: {"type":\ndata: "RUN_STARTED"}\n\n');
    for await (const item of readAgUiEvents(multiline.body))
      expect(item.event.type).toBe("RUN_STARTED");
  });

  it("submits once and reconnects with an exact cursor, deduplicating message chunks", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(start + accepted + delta))
      .mockResolvedValueOnce(response(delta + done));
    const events = [],
      checkpoints = [];
    const result = await runWorkflowAgUi({
      ...options,
      fetchImpl: fetch,
      onEvent: (item) => events.push(item),
      onCheckpoint: (value) => checkpoints.push(value),
    });
    expect(fetch.mock.calls.map(([, request]) => request.method)).toEqual(["POST", "GET"]);
    expect(fetch.mock.calls[1][0].pathname).toBe("/api/agui/v1/runs/internal/events");
    expect(fetch.mock.calls[1][1].headers["Last-Event-ID"]).toBe("internal:2:2");
    expect(events.filter((item) => item.type === "TEXT_MESSAGE_CONTENT")).toHaveLength(1);
    expect(result.event.result.answer).toBe("你好😀");
    expect(checkpoints.at(-1).completed).toBe(true);
    expect(checkpoints.at(-1)).not.toHaveProperty("apiKey");
  });

  it("retries the same submission safely when it loses the accepted mapping", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(start))
      .mockResolvedValueOnce(response(accepted + done));
    await runWorkflowAgUi({ ...options, fetchImpl: fetch });
    expect(fetch.mock.calls.map(([, request]) => request.method)).toEqual(["POST", "POST"]);
    expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
    expect(fetch.mock.calls[1][1].headers["Last-Event-ID"]).toBe("internal:1:1");
    expect(fetch.mock.calls[1][1].headers["Idempotency-Key"]).toBe("agui:turn");
  });

  it.each([400, 401, 403, 404, 409])("does not retry denied HTTP %s", async (status) => {
    const fetch = vi.fn().mockResolvedValue(new Response("denied", { status }));
    await expect(runWorkflowAgUi({ ...options, fetchImpl: fetch })).rejects.toThrow(
      `HTTP ${status}`,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("stops and clears provisional UI on a resource-revoked RUN_ERROR", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        response(
          start +
            accepted +
            'data: {"type":"RUN_ERROR","code":"stream_access_lost","message":"revoked","metadata":{"retryable":false,"clearPreview":true}}\n\n',
        ),
      );
    const onEvent = vi.fn();
    await expect(runWorkflowAgUi({ ...options, fetchImpl: fetch, onEvent })).rejects.toThrow(
      "revoked",
    );
    expect(onEvent.mock.calls.at(-1)[0].metadata.clearPreview).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry a failed UI consumer, checkpoint store, malformed frame or wrong response type", async () => {
    for (const override of [
      {
        onEvent: () => {
          throw new TypeError("UI error");
        },
      },
      {
        onCheckpoint: () => {
          throw new TypeError("storage error");
        },
      },
    ]) {
      const fetch = vi.fn().mockResolvedValue(response(start));
      await expect(runWorkflowAgUi({ ...options, fetchImpl: fetch, ...override })).rejects.toThrow(
        "consumer failed",
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    }
    for (const bad of [response("data: broken\n\n"), new Response("{}")]) {
      const fetch = vi.fn().mockResolvedValue(bad);
      await expect(runWorkflowAgUi({ ...options, fetchImpl: fetch })).rejects.toThrow();
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });

  it("does not retry when a terminal-error UI consumer throws a TypeError", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        response(
          'data: {"type":"RUN_ERROR","message":"revoked","metadata":{"retryable":true}}\n\n',
        ),
      );
    await expect(
      runWorkflowAgUi({
        ...options,
        fetchImpl: fetch,
        onEvent: () => {
          throw new TypeError("UI error");
        },
      }),
    ).rejects.toThrow("Event consumer failed: UI error");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("restores active or completed checkpoints through GET only and rechecks the completed result", async () => {
    for (const completed of [false, true]) {
      const fetch = vi.fn().mockResolvedValue(response(done));
      await runWorkflowAgUi({
        ...options,
        fetchImpl: fetch,
        checkpoint: {
          internalRunId: "internal",
          cursor: "internal:2:2",
          threadId: "thread",
          runId: "turn",
          completed,
        },
      });
      expect(fetch.mock.calls[0][1].method).toBe("GET");
      expect(fetch.mock.calls[0][1].headers["Last-Event-ID"]).toBe(
        completed ? undefined : "internal:2:2",
      );
    }
    await expect(runWorkflowAgUi({ ...options, checkpoint: { runId: "other" } })).rejects.toThrow(
      "different run",
    );
  });

  it("aborts a blocked read without cancelling the background run", async () => {
    const controller = new AbortController();
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(new ReadableStream(), { headers: { "Content-Type": "text/event-stream" } }),
      );
    const pending = runWorkflowAgUi({ ...options, fetchImpl: fetch, signal: controller.signal });
    const rejected = expect(pending).rejects.toThrow("stop");
    await new Promise((resolve) => setTimeout(resolve, 1));
    controller.abort(new Error("stop"));
    await rejected;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].method).toBe("POST");
  });

  it("cancels a pending retry without another POST and uses DELETE for explicit business cancellation", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetch = vi.fn().mockResolvedValue(response(""));
    const pending = runWorkflowAgUi({
      ...options,
      fetchImpl: fetch,
      retryDelayMs: 1000,
      signal: controller.signal,
    });
    const rejected = expect(pending).rejects.toThrow("stop");
    await vi.advanceTimersByTimeAsync(1);
    controller.abort(new Error("stop"));
    await rejected;
    expect(fetch).toHaveBeenCalledTimes(1);
    const cancel = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await cancelWorkflowAgUi({ ...options, internalRunId: "internal", fetchImpl: cancel });
    expect(cancel.mock.calls[0][1].method).toBe("DELETE");
  });
});
