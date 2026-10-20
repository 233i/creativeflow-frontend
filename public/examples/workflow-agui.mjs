/** Dependency-free AG-UI workflow client. Keep API keys on your business backend in production. */
export class WorkflowAgUiError extends Error {
  constructor(message, { code, status, retryable = false } = {}) {
    super(message); this.name = "WorkflowAgUiError";
    this.code = code; this.status = status; this.retryable = retryable;
  }
}

/** Reads SSE incrementally, including split UTF-8 / CRLF and multi-line data. Comments are ignored. */
export async function* readAgUiEvents(body, signal) {
  if (!body) throw new WorkflowAgUiError("Missing event stream");
  const reader = body.getReader(); const decoder = new TextDecoder();
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", abort, { once: true });
  let buffer = "", id = "", data = [];
  try {
    while (true) {
      signal?.throwIfAborted();
      const { value, done } = await reader.read();
      signal?.throwIfAborted();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 2 * 1024 * 1024) throw new WorkflowAgUiError("SSE frame exceeds 2 MiB");
      let boundary;
      while ((boundary = buffer.search(/\r\n|\n|\r/)) >= 0) {
        if (!done && buffer[boundary] === "\r" && boundary === buffer.length - 1) break;
        const line = buffer.slice(0, boundary);
        const length = buffer[boundary] === "\r" && buffer[boundary + 1] === "\n" ? 2 : 1;
        buffer = buffer.slice(boundary + length);
        if (line === "") {
          if (data.length) {
            let event;
            try { event = JSON.parse(data.join("\n")); } catch { throw new WorkflowAgUiError("Invalid AG-UI JSON event"); }
            if (typeof event.type !== "string") throw new WorkflowAgUiError("Missing AG-UI event type");
            yield { id, event };
          }
          id = ""; data = [];
        } else if (!line.startsWith(":")) {
          const separator = line.indexOf(":");
          const name = separator < 0 ? line : line.slice(0, separator);
          let text = separator < 0 ? "" : line.slice(separator + 1);
          if (text.startsWith(" ")) text = text.slice(1);
          if (name === "id" && !text.includes("\0")) id = text;
          if (name === "data") data.push(text);
          if (data.reduce((total, item) => total + item.length, 0) > 2 * 1024 * 1024) throw new WorkflowAgUiError("SSE frame exceeds 2 MiB");
        }
      }
      if (done) return; // A partial frame is not acknowledged; reconnection reads it again.
    }
  } finally { signal?.removeEventListener("abort", abort); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

function newer(id, cursor) {
  if (!cursor) return true;
  const a = id.split(":"), b = cursor.split(":");
  if (a.length !== 3 || b.length !== 3 || a[0] !== b[0]) throw new WorkflowAgUiError("Invalid event cursor");
  return BigInt(a[1]) > BigInt(b[1]) || (a[1] === b[1] && Number(a[2]) > Number(b[2]));
}

/**
 * Resolves only at a terminal event. Abort cancels the subscription, NOT the durable task.
 * Save onCheckpoint (without apiKey) if you need to resume after closing the page.
 */
export async function runWorkflowAgUi({ baseUrl, workflowId, apiKey, inputs, threadId, runId,
  idempotencyKey, checkpoint, onEvent = () => {}, onCheckpoint = () => {}, signal,
  fetchImpl = fetch, maxRetries = 5, retryDelayMs = 2000 }) {
  if (!threadId || !runId) throw new WorkflowAgUiError("threadId and runId are required");
  if (checkpoint && (checkpoint.threadId !== threadId || checkpoint.runId !== runId)) throw new WorkflowAgUiError("Checkpoint belongs to a different run");
  const root = new URL(baseUrl);
  const submitted = new URL(`/api/agui/v1/workflows/${encodeURIComponent(workflowId)}/runs`, root);
  // Completed checkpoints replay the existing run to revalidate resources and refresh signed media URLs.
  let internalRunId = checkpoint?.internalRunId ?? null, cursor = checkpoint?.completed ? "" : checkpoint?.cursor ?? "", attempts = 0, completed = false;
  const body = JSON.stringify({ threadId, runId, messages: [], tools: [], context: [], state: {}, forwardedProps: { inputs } });
  const save = () => onCheckpoint({ internalRunId, cursor, threadId, runId, completed });
  while (true) {
    signal?.throwIfAborted();
    let response;
    try {
      const headers = { Authorization: `Bearer ${apiKey}`, Accept: "text/event-stream" };
      if (cursor) headers["Last-Event-ID"] = cursor;
      if (!internalRunId) { headers["Content-Type"] = "application/json"; headers["Idempotency-Key"] = idempotencyKey ?? `agui:${runId}`; }
      const url = internalRunId ? new URL(`/api/agui/v1/runs/${encodeURIComponent(internalRunId)}/events`, root) : submitted;
      response = await fetchImpl(url, { method: internalRunId ? "GET" : "POST", headers, body: internalRunId ? undefined : body, signal });
      if (!response.ok) {
        let error = {}; try { error = await response.json(); } catch { /* Non-JSON gateway failure. */ }
        throw new WorkflowAgUiError(error.error?.message ?? `HTTP ${response.status}`, {
          status: response.status, code: error.error?.code, retryable: [429, 502, 503, 504].includes(response.status) });
      }
      if (!response.headers.get("content-type")?.includes("text/event-stream")) throw new WorkflowAgUiError("Expected text/event-stream");
      internalRunId ??= response.headers.get("X-Workflow-Run-ID");
      for await (const frame of readAgUiEvents(response.body, signal)) {
        if (frame.id && !newer(frame.id, cursor)) continue;
        if (frame.event.type === "CUSTOM" && frame.event.name === "workflow.accepted") internalRunId = frame.event.value.internalRunId;
        if (frame.event.type === "RUN_ERROR") {
          try { await onEvent(frame.event); } catch (error) { throw new WorkflowAgUiError(`Event consumer failed: ${error.message}`); }
          throw new WorkflowAgUiError(frame.event.message, { code: frame.event.code, retryable: frame.event.metadata?.retryable === true });
        }
        // A consumer exception must not become an automatic retry of side effects.
        try { await onEvent(frame.event); } catch (error) { throw new WorkflowAgUiError(`Event consumer failed: ${error.message}`); }
        if (frame.id) cursor = frame.id;
        completed = frame.event.type === "RUN_FINISHED";
        try { await save(); } catch (error) { throw new WorkflowAgUiError(`Checkpoint consumer failed: ${error.message}`); }
        if (frame.event.type === "RUN_FINISHED") return { event: frame.event, internalRunId, cursor };
      }
      throw new WorkflowAgUiError("Stream interrupted before terminal event", { retryable: true });
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      const retryable = error instanceof WorkflowAgUiError ? error.retryable : error instanceof TypeError;
      if (!retryable || attempts++ >= maxRetries) throw error;
      const wait = Math.min(30000, Math.max(retryDelayMs, Number(response?.headers.get("retry-after") ?? 0) * 1000) * 2 ** (attempts - 1));
      await new Promise((resolve, reject) => {
        const cancel = () => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); reject(signal.reason); };
        const timer = setTimeout(() => { signal?.removeEventListener("abort", cancel); resolve(); }, wait);
        signal?.addEventListener("abort", cancel, { once: true });
      });
    }
  }
}

/** Explicit business cancellation; this does not generate a replacement task. */
export async function cancelWorkflowAgUi({ baseUrl, apiKey, internalRunId, signal, fetchImpl = fetch }) {
  const response = await fetchImpl(new URL(`/api/external/v1/runs/${encodeURIComponent(internalRunId)}`, baseUrl), {
    method: "DELETE", headers: { Authorization: `Bearer ${apiKey}` }, signal });
  if (!response.ok) throw new WorkflowAgUiError(`Cancel failed: HTTP ${response.status}`, { status: response.status });
}
