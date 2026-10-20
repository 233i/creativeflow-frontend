import { createApiClient } from "@/lib/api-client";
import type {
  AgentEventEnvelope,
  AgentImageAttachment,
  AgentMessage,
  AgentToolCatalogEntry,
  AgentRun,
  AgentSession,
  AgentStoredEvent,
} from "@/features/agent/types";

const BASE = "/api/v1/agent";

export class AgentApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = "AgentApiError";
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

const request = createApiClient({
  baseUrl: BASE,
  createError: ({ code, details, status, fallbackMessage }) =>
    new AgentApiError(details[0] ?? code ?? fallbackMessage, status, details),
});

export async function findSession(canvasId: string): Promise<AgentSession | null> {
  try {
    return await request(`/sessions?canvasId=${encodeURIComponent(canvasId)}`);
  } catch (error) {
    if (error instanceof AgentApiError && error.isNotFound) return null;
    throw error;
  }
}

export function createSession(canvasId: string, title?: string): Promise<AgentSession> {
  return request("/sessions", {
    method: "POST",
    body: JSON.stringify({ canvasId, title: title ?? null }),
  });
}

export async function listMessages(sessionId: string): Promise<AgentMessage[]> {
  const response = await request<{ messages: AgentMessage[] }>(
    `/sessions/${encodeURIComponent(sessionId)}/messages`,
  );
  return response.messages;
}

export function clearMessages(sessionId: string): Promise<void> {
  return request(`/sessions/${encodeURIComponent(sessionId)}/messages`, { method: "DELETE" });
}

export function createRun(
  sessionId: string,
  input: {
    providerId: string;
    modelKey: string;
    prompt: string;
    images?: AgentImageAttachment[];
    executorConnectionId?: string | null;
  },
): Promise<AgentRun> {
  return request(`/sessions/${encodeURIComponent(sessionId)}/runs`, {
    method: "POST",
    body: JSON.stringify({
      ...input,
      images: input.images?.map((image) => image.url),
    }),
  });
}

export async function findActiveRun(canvasId: string): Promise<AgentRun | null> {
  try {
    return await request(`/runs/active?canvasId=${encodeURIComponent(canvasId)}`);
  } catch (error) {
    if (error instanceof AgentApiError && error.isNotFound) return null;
    throw error;
  }
}

export function getRun(runId: string): Promise<AgentRun> {
  return request(`/runs/${encodeURIComponent(runId)}`);
}

export async function listEvents(runId: string, afterSequence = 0): Promise<AgentStoredEvent[]> {
  const response = await request<{ events: AgentStoredEvent[] }>(
    `/runs/${encodeURIComponent(runId)}/events?afterSeq=${afterSequence}`,
  );
  return response.events;
}

export function cancelRun(runId: string): Promise<void> {
  return request(`/runs/${encodeURIComponent(runId)}`, { method: "DELETE" });
}

export async function listTools(): Promise<AgentToolCatalogEntry[]> {
  const response = await request<{ tools: AgentToolCatalogEntry[] }>("/tools");
  return response.tools;
}

export function envelopeFromStored(event: AgentStoredEvent): AgentEventEnvelope {
  let text: string | null = null;
  let error: string | null = null;

  try {
    const payload = JSON.parse(event.payloadJson) as { text?: unknown; error?: unknown };
    text = typeof payload.text === "string" ? payload.text : null;
    error = typeof payload.error === "string" ? payload.error : null;
  } catch {
    // 原始负载仍可通过 `json` 使用；格式错误的可选字段会被忽略。
  }

  return {
    runId: event.runId,
    sequence: event.sequence,
    type: event.type,
    text,
    json: event.payloadJson,
    error,
    sentAt: event.createdAt,
  };
}
