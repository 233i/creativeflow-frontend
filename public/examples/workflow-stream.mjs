/**
 * 在服务器或可信客户端使用；不要把长期 API Key 放进公开网页。
 * 先 POST 工作流 runs，设置 { inputs: {...}, stream: true }，再订阅返回的 eventsUrl。
 * for await (const event of workflowEvents(eventsUrl, apiKey, { signal })) {
 *   // output.delta: 按 data.output + data.path 追加 data.delta；保存 event.id 供恢复。
 *   // run.completed: 用 data.outputs 替换预览；run.failed / run.cancelled: 清除预览。
 * }
 */
export async function* workflowEvents(url, apiKey, { signal, lastEventId = "", maxRetries = 5 } = {}) {
  let cursor = lastEventId;
  let retries = 0;
  while (!signal?.aborted) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "text/event-stream", ...(cursor ? { "Last-Event-ID": cursor } : {}) },
        cache: "no-store", signal,
      });
      if (response.status === 204) return;
      if (!response.ok) {
        const error = new Error(`订阅失败：HTTP ${response.status}`);
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }
      if (!response.body || !response.headers.get("content-type")?.startsWith("text/event-stream")) {
        const error = new Error("订阅端点未返回 SSE"); error.retryable = false; throw error;
      }
      const reader = response.body.getReader();
      try {
        for await (const event of parseEvents(reader)) {
          if (event.event === "stream.error") {
            const error = new Error(event.data.message ?? "订阅中断");
            error.retryable = event.data.retryable === true;
            throw error;
          }
          // 消费者先处理事件；只有继续迭代后，才把该 ID 视为已成功处理。
          yield event;
          if (event.id) { cursor = event.id; retries = 0; }
          if (["run.completed", "run.failed", "run.cancelled"].includes(event.event)) return;
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      throw new Error("连接中断，续读同一个运行");
    } catch (error) {
      if (signal?.aborted) throw signal.reason ?? error;
      if (error.retryable === false || retries++ >= maxRetries) throw error;
      await delay(Math.min(1000 * 2 ** (retries - 1), 10000), signal);
    }
  }
  if (signal?.aborted) throw signal.reason;
}

/** 支持跨网络块的 UTF-8、CRLF 和多行 data；未以空行结束的帧不会确认游标。 */
export async function* parseEvents(reader) {
  const decoder = new TextDecoder();
  let buffer = "", event = "message", id, lines = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, boundary).replace(/\r$/, "");
      buffer = buffer.slice(boundary + 1);
      if (line === "") {
        if (lines.length) yield { event, ...(id ? { id } : {}), data: JSON.parse(lines.join("\n")) };
        event = "message"; id = undefined; lines = [];
      } else if (!line.startsWith(":")) {
        const colon = line.indexOf(":"), field = colon < 0 ? line : line.slice(0, colon);
        const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
        if (field === "event") event = value;
        if (field === "id" && !value.includes("\0")) id = value;
        if (field === "data") lines.push(value);
      }
    }
  }
}

function delay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const onAbort = () => { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); reject(signal.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, milliseconds);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}
