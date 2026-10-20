"use client";

import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import type { WorkflowRunChangedEvent } from "@/features/workflow/types";
import { handshake } from "@/lib/device";

const METHOD = "WorkflowRunChanged";
const listeners = new Set<(event: WorkflowRunChangedEvent) => void>();
let connection: HubConnection | null = null;
let starting: Promise<void> | null = null;

function currentConnection(): HubConnection {
  if (connection) return connection;
  connection = new HubConnectionBuilder()
    .withUrl("/hubs/creativeflow", { withCredentials: true })
    .withAutomaticReconnect([0, 2_000, 10_000, 30_000])
    .configureLogging(process.env.NODE_ENV === "development" ? LogLevel.Warning : LogLevel.Error)
    .build();
  connection.on(METHOD, (event: WorkflowRunChangedEvent) => {
    listeners.forEach((listener) => listener(event));
  });
  return connection;
}

async function ensureStarted(): Promise<void> {
  const hub = currentConnection();
  if (hub.state === HubConnectionState.Connected) return;
  if (starting) return starting;
  starting = (async () => {
    await handshake();
    if (hub.state === HubConnectionState.Disconnected) await hub.start();
  })();
  try {
    await starting;
  } finally {
    starting = null;
  }
}

async function stopIfIdle(): Promise<void> {
  const pendingStart = starting;
  if (pendingStart) {
    try {
      await pendingStart;
    } catch {
      // 启动失败时连接已经处于断开状态。
    }
  }

  const hub = connection;
  if (listeners.size === 0 && hub && hub.state !== HubConnectionState.Disconnected) {
    await hub.stop();
  }
}

export function subscribeWorkflowRuns(
  listener: (event: WorkflowRunChangedEvent) => void,
): () => void {
  listeners.add(listener);
  void ensureStarted().catch(() => undefined);
  return () => {
    listeners.delete(listener);
    // 严格模式会连续释放并重新获取副作用。让出一次执行，防止开发环境重新挂载时
    // 停止替代订阅者即将复用的连接。
    void Promise.resolve().then(() => {
      void stopIfIdle().catch(() => undefined);
    });
  };
}
