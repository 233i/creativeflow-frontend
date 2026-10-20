import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowExternalApiManifest } from "@/features/workflow/types";
import type { WorkflowDeployment } from "./api";
import * as api from "./api";
import { WorkflowPublishPanel } from "./publish-panel";

vi.mock("./api", () => ({
  listDeployments: vi.fn(),
  listApiKeys: vi.fn(),
  listExternalRuns: vi.fn(),
  publishWorkflow: vi.fn(),
  createApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
  disableWorkflow: vi.fn(),
}));

const draft: WorkflowExternalApiManifest = {
  schemaVersion: 1,
  inputs: [
    {
      key: "draft_prompt",
      label: "草稿提示词",
      description: "",
      type: "string",
      required: true,
      target: { nodeId: "prompt", field: "text" },
    },
  ],
  outputs: [{ key: "draft_result", label: "草稿输出", type: "image", nodeId: "out" }],
};
const published: WorkflowDeployment = {
  id: "deployment-1",
  workflowId: "workflow-id",
  version: 1,
  schemaVersion: 1,
  description: "线上工作流",
  status: "published",
  maxConcurrency: 2,
  inputs: [{ ...draft.inputs[0], key: "live_prompt", label: "线上提示词", default: "线上示例" }],
  outputs: [{ ...draft.outputs[0], key: "live_result", label: "线上输出" }],
  publishedAt: "2026-09-01T00:00:00Z",
  disabledAt: null,
};

function panel(manifest = draft) {
  return (
    <WorkflowPublishPanel
      workflowId="workflow-id"
      workflowName="测试工作流"
      updatedAt="2026-09-02T00:00:00Z"
      manifest={manifest}
      isOpen
      onOpenChange={vi.fn()}
      onBeforePublish={async () => true}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listDeployments).mockResolvedValue({ deployments: [published] });
  vi.mocked(api.listApiKeys).mockResolvedValue({ apiKeys: [] });
  vi.mocked(api.listExternalRuns).mockResolvedValue({ runs: [] });
});

describe("workflow publication contract", () => {
  it("offers AG-UI for the published contract with identity, resume and client guidance", async () => {
    const user = userEvent.setup();
    render(panel());
    await screen.findByText("live_prompt");
    await user.click(screen.getByRole("tab", { name: "调用示例" }));
    await user.click(screen.getByRole("button", { name: "AG-UI 标准协议" }));
    const example = screen.getByRole("tabpanel", { name: "调用示例" });
    expect(example).toHaveTextContent("/api/agui/v1/workflows/workflow-id/runs");
    expect(example).toHaveTextContent('"live_prompt": "线上示例"');
    expect(example).not.toHaveTextContent("draft_prompt");
    expect(example).toHaveTextContent("RUN_FINISHED.result");
    expect(example).toHaveTextContent("Last-Event-ID");
    expect(screen.getByRole("link", { name: "下载 AG-UI JavaScript 客户端示例" })).toHaveAttribute(
      "href",
      "/examples/workflow-agui.mjs",
    );
    await user.click(screen.getByRole("button", { name: "查询最终结果" }));
    expect(example).toHaveTextContent("每隔 2–5 秒 GET statusUrl");
    expect(api.publishWorkflow).not.toHaveBeenCalled();
    expect(api.createApiKey).not.toHaveBeenCalled();
  });
  it("uses a short credential dialog and clears the secret on visibility reauthorization failure", async () => {
    vi.mocked(api.createApiKey).mockResolvedValue({
      id: "key1",
      key: "synthetic-secret-only",
      name: "Production",
      prefix: "qa",
      hint: "only",
      enabled: true,
      expiresAt: null,
      lastUsedAt: null,
      createdAt: "2026-09-13T00:00:00Z",
      revokedAt: null,
    });
    const user = userEvent.setup();
    render(
      <WorkflowPublishPanel
        workflowId="workflow-id"
        workflowName="测试工作流"
        updatedAt="2026-09-02T00:00:00Z"
        manifest={draft}
        isOpen
        page="access"
        onOpenChange={vi.fn()}
        onBeforePublish={async () => true}
      />,
    );
    await user.click(await screen.findByRole("button", { name: "签发凭证" }));
    expect(screen.getByRole("dialog", { name: "签发 API 凭证" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "确认签发" }));
    expect(await screen.findByText("synthetic-secret-only")).toBeVisible();
    vi.mocked(api.listApiKeys).mockRejectedValue(
      Object.assign(new Error("forbidden"), { status: 403 }),
    );
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(screen.queryByText("synthetic-secret-only")).toBeNull());
    expect(screen.queryByRole("dialog", { name: "签发 API 凭证" })).toBeNull();
    expect(api.createApiKey).toHaveBeenCalledTimes(1);
    expect(api.publishWorkflow).not.toHaveBeenCalled();
  });

  it("preserves unpublished metadata during a read-only refresh", async () => {
    const user = userEvent.setup();
    render(panel());
    const description = await screen.findByDisplayValue("线上工作流");
    await user.clear(description);
    await user.type(description, "尚未发布的修改");
    await user.click(screen.getByRole("button", { name: "刷新" }));
    await waitFor(() => expect(api.listDeployments).toHaveBeenCalledTimes(2));
    expect(screen.getByDisplayValue("尚未发布的修改")).toBeVisible();
    expect(api.publishWorkflow).not.toHaveBeenCalled();
  });
  it("keeps the published fields and example when the draft changes", async () => {
    const user = userEvent.setup();
    const view = render(panel());
    expect(await screen.findByText("live_prompt")).toBeVisible();
    expect(screen.getByText("live_result")).toBeVisible();
    expect(screen.queryByText("draft_prompt")).toBeNull();
    expect(screen.queryByText("draft_result")).toBeNull();

    view.rerender(panel({ ...draft, inputs: [{ ...draft.inputs[0], key: "another_draft_key" }] }));
    await user.click(screen.getByRole("tab", { name: "调用示例" }));
    const example = screen.getByRole("tabpanel", { name: "调用示例" });
    expect(example).toHaveTextContent('"live_prompt": "线上示例"');
    expect(example).not.toHaveTextContent("another_draft_key");
    expect(example).not.toHaveTextContent("draft_prompt");
  });

  it("preserves a published contract with no inputs", async () => {
    vi.mocked(api.listDeployments).mockResolvedValue({
      deployments: [{ ...published, inputs: [] }],
    });
    const user = userEvent.setup();
    render(panel());
    await screen.findByText("当前发布版本 v1 的参数契约");
    expect(screen.queryByText("draft_prompt")).toBeNull();
    await user.click(screen.getByRole("tab", { name: "调用示例" }));
    expect(screen.getByRole("tabpanel", { name: "调用示例" })).toHaveTextContent('"inputs": {}');
  });

  it("previews the draft before publication and switches to the newly published contract", async () => {
    vi.mocked(api.listDeployments)
      .mockResolvedValueOnce({ deployments: [] })
      .mockResolvedValue({ deployments: [published] });
    vi.mocked(api.publishWorkflow).mockResolvedValue(published);
    const user = userEvent.setup();
    render(panel());
    expect(await screen.findByText("draft_prompt")).toBeVisible();
    expect(screen.getByText("草稿参数预览，发布后生效")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "发布 API" }));
    await waitFor(() => expect(screen.getByText("live_prompt")).toBeVisible());
    expect(screen.queryByText("draft_prompt")).toBeNull();
  });
});
