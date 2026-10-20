import { afterEach, describe, expect, it, vi } from "vitest";

const { withUrl, handshake } = vi.hoisted(() => ({
  withUrl: vi.fn(),
  handshake: vi.fn(async () => undefined),
}));

vi.mock("@/lib/device", () => ({ handshake }));
vi.mock("@microsoft/signalr", () => ({
  HubConnectionState: { Connected: "connected", Disconnected: "disconnected" },
  LogLevel: { Warning: 3, Error: 4 },
  HubConnectionBuilder: class {
    withUrl(...args: unknown[]) {
      withUrl(...args);
      return this;
    }
    withAutomaticReconnect() {
      return this;
    }
    configureLogging() {
      return this;
    }
    build() {
      return {
        state: "disconnected",
        on: vi.fn(),
        onclose: vi.fn(),
        onreconnected: vi.fn(),
        async start() {
          this.state = "connected";
        },
        async stop() {
          this.state = "disconnected";
        },
      };
    }
  },
}));

const cleanups: Array<() => void> = [];
afterEach(async () => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  await Promise.resolve();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("CreativeFlow realtime endpoint", () => {
  it("uses the current authenticated hub for workflow and Agent events", async () => {
    const { subscribeWorkflowRuns } = await import("./realtime");
    const { subscribeAgentEvents } = await import("../agent/realtime");
    cleanups.push(subscribeWorkflowRuns(vi.fn()), subscribeAgentEvents(vi.fn()));
    await vi.waitFor(() => expect(handshake).toHaveBeenCalledTimes(2));
    expect(withUrl).toHaveBeenCalledTimes(2);
    for (const call of withUrl.mock.calls) {
      expect(call).toEqual(["/hubs/creativeflow", { withCredentials: true }]);
    }
  });
});
