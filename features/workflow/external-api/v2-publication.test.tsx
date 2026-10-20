import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildWorkflowCurl, buildWorkflowPollCurl } from "./call-example";
import { v2PublicationManifest } from "./contracts";
import { createV2Workflow } from "../v2/types";
import { WorkflowPublishPanel } from "./publish-panel";
import { V2RunHistory } from "../v2/run-history";
import { ExternalRunDetails } from "./run-details";
import type { createWorkflowApiClient } from "../api";
import type { WorkflowRun } from "../types";
import * as api from "./api";

vi.mock("./api", () => ({
  listDeployments: vi.fn(),
  listApiKeys: vi.fn(),
  listExternalRuns: vi.fn(),
  publishWorkflow: vi.fn(),
  createApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
  disableWorkflow: vi.fn(),
  getExternalRun: vi.fn(),
}));
const manifest = v2PublicationManifest(createV2Workflow());
const run = {
  id: "run1",
  workflowId: "wf",
  resumedFromRunId: null,
  status: "succeeded",
  error: null,
  createdAt: "2026-09-12T00:00:00Z",
  updatedAt: "2026-09-12T00:00:01Z",
  startedAt: "2026-09-12T00:00:00Z",
  finishedAt: "2026-09-12T00:00:01Z",
  nodes: [
    {
      nodeId: "end",
      nodeType: "end",
      status: "succeeded",
      isReused: false,
      progress: 1,
      output: { schemaVersion: 1, fields: { answer: "合成结果" } },
      error: null,
      startedAt: null,
      finishedAt: null,
    },
  ],
} as unknown as WorkflowRun;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.listDeployments).mockResolvedValue({ deployments: [] });
  vi.mocked(api.listApiKeys).mockResolvedValue({ apiKeys: [] });
  vi.mocked(api.listExternalRuns).mockResolvedValue({ runs: [] });
});

describe("v2 publication and history", () => {
  it("exports only start/end fields and builds typed examples plus GET polling", () => {
    const graph = createV2Workflow();
    graph.nodes[1].data.modelId = "private-model";
    graph.nodes[1].data.operationId = "private-operation";
    const value = v2PublicationManifest(graph);
    expect(JSON.stringify(value)).not.toContain("private-");
    expect(value.inputs[0].key).toBe("question");
    expect(value.outputs[0].key).toBe("answer");
    const sample = buildWorkflowCurl("wf", [
      { key: "quantity", type: "number", minimum: 3, maximum: 10 },
      { key: "enabled", type: "boolean" },
      { key: "payload", type: "object" },
      { key: "items", type: "array" },
      { key: "text", type: "string", maxLength: 2 },
    ]);
    expect(sample).toContain('"quantity": 3');
    expect(sample).toContain('"enabled": false');
    expect(sample).toContain('"payload": {}');
    expect(sample).toContain('"items": []');
    expect(sample).toContain('"text": "请填"');
    expect(buildWorkflowPollCurl()).toContain("/runs/");
    expect(buildWorkflowPollCurl()).not.toContain("-X POST");
  });

  it("saves before publishing and ignores a second click while save is pending", async () => {
    const user = userEvent.setup();
    let finish!: (value: boolean) => void;
    const save = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <WorkflowPublishPanel
        workflowId="wf"
        workflowName="合成 API"
        updatedAt="2026-09-12T00:00:00Z"
        manifest={manifest}
        isOpen
        onOpenChange={vi.fn()}
        onBeforePublish={save}
      />,
    );
    const publish = await screen.findByRole("button", { name: "发布 API" });
    await user.dblClick(publish);
    expect(save).toHaveBeenCalledOnce();
    expect(api.publishWorkflow).not.toHaveBeenCalled();
    await act(async () => {
      finish(true);
    });
    await waitFor(() => expect(api.publishWorkflow).toHaveBeenCalledOnce());
    expect(api.publishWorkflow).toHaveBeenCalledWith("wf", "", 2);
  });

  it("explains independent Key grants and asynchronous typed results", async () => {
    const user = userEvent.setup();
    vi.mocked(api.listApiKeys).mockResolvedValue({
      apiKeys: [
        {
          id: "key-record-id",
          name: "外部客户",
          prefix: "cf_live_test",
          hint: "abcd",
          enabled: true,
          expiresAt: null,
          lastUsedAt: null,
          createdAt: "2026-09-12T00:00:00Z",
          revokedAt: null,
          key: null,
        },
      ],
    });
    render(
      <WorkflowPublishPanel
        workflowId="wf"
        workflowName="合成 API"
        updatedAt="2026-09-12T00:00:00Z"
        manifest={manifest}
        isOpen
        onOpenChange={vi.fn()}
        onBeforePublish={async () => true}
      />,
    );
    await screen.findByRole("tab", { name: "API Key" });
    await user.click(screen.getByRole("tab", { name: "API Key" }));
    expect(screen.getByText("key-record-id")).toBeVisible();
    expect(screen.getByRole("link", { name: "知识库授权" })).toHaveAttribute(
      "href",
      "/admin?tab=knowledge",
    );
    expect(screen.getByText(/不同 Key 不能读取彼此/)).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "调用示例" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("202、runId、statusUrl 和 eventsUrl");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("原幂等键、原输入和原 stream 设置");
    expect(screen.getByRole("tabpanel")).toHaveTextContent('"stream": true');
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Last-Event-ID");
    expect(screen.getByRole("link", { name: "下载 JavaScript 订阅示例" })).toHaveAttribute(
      "href",
      "/examples/workflow-stream.mjs",
    );
    await user.click(screen.getByRole("button", { name: "查询最终结果" }));
    expect(screen.getByRole("tabpanel")).not.toHaveTextContent('"stream": true');
    expect(screen.getByRole("tabpanel")).toHaveTextContent("每隔 2–5 秒 GET statusUrl");
    expect(api.publishWorkflow).not.toHaveBeenCalled();
    expect(api.createApiKey).not.toHaveBeenCalled();
  });

  it("reads a selected historical run without changing its graph or generating again", async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    const close = vi.fn();
    const list = vi.fn().mockResolvedValue({ runs: [run] });
    const get = vi.fn().mockResolvedValue(run);
    const client = { listWorkflowRuns: list, getWorkflowRun: get } as unknown as ReturnType<
      typeof createWorkflowApiClient
    >;
    render(
      <V2RunHistory
        workflowId="wf"
        client={client}
        onClose={close}
        onSelect={select}
        onDenied={vi.fn()}
      />,
    );
    await user.click(await screen.findByRole("button", { name: "查看此运行" }));
    await waitFor(() => expect(select).toHaveBeenCalledExactlyOnceWith(run));
    expect(get).toHaveBeenCalledWith("wf", "run1");
    expect(close).toHaveBeenCalledOnce();
  });

  it("clears cached node content when ongoing result checks lose permission", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(api.getExternalRun).mockResolvedValue(run);
      render(<ExternalRunDetails workflowId="wf" runId="run1" onClose={vi.fn()} />);
      await act(async () => {});
      expect(screen.getByText(/合成结果/)).toBeInTheDocument();
      vi.mocked(api.getExternalRun).mockRejectedValue(
        Object.assign(new Error("资源已撤权"), { status: 403 }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });
      expect(screen.queryByText(/合成结果/)).not.toBeInTheDocument();
      expect(within(screen.getByRole("alert")).getByText("资源已撤权")).toBeVisible();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(api.getExternalRun).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
