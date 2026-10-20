import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkflowApiManagementPanel } from "./workflow-api-management-panel";
import * as api from "./workflow-api";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("./workflow-api", () => ({
  listWorkflowApis: vi.fn(),
  editorApi: { createWorkflow: vi.fn(), getWorkflow: vi.fn() },
}));
vi.mock("@/features/workflow/external-api/publish-panel", () => ({
  WorkflowPublishPanel: ({
    workflowId,
    manifest,
    onOpenChange,
  }: {
    workflowId: string;
    manifest: { outputs: { key: string }[] };
    onOpenChange: (open: boolean) => void;
  }) => (
    <div role="dialog" aria-label="发布管理">
      <p>{workflowId}</p>
      <p>{manifest.outputs[0]?.key}</p>
      <button onClick={() => onOpenChange(false)}>关闭发布管理</button>
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listWorkflowApis).mockResolvedValue({
    apis: [
      {
        id: "published-id",
        name: "商品海报 API",
        status: "published",
        version: 3,
        updatedAt: "2026-09-08T00:00:00Z",
      },
      {
        id: "draft-id",
        name: "新 API",
        status: "draft",
        version: null,
        updatedAt: "2026-09-08T00:00:00Z",
      },
      {
        id: "disabled-id",
        name: "旧 API",
        status: "disabled",
        version: 1,
        updatedAt: "2026-09-08T00:00:00Z",
      },
    ],
  });
});

describe("API management", () => {
  it("lists all lifecycle states, filters, and opens the shared editor", async () => {
    const user = userEvent.setup();
    render(<WorkflowApiManagementPanel />);
    await screen.findByText("商品海报 API");
    expect(screen.getByText("v3")).toBeVisible();
    expect(screen.getByText("旧 API")).toBeVisible();
    await user.selectOptions(screen.getByRole("combobox", { name: "API 状态" }), "published");
    expect(screen.queryByText("旧 API")).toBeNull();
    expect(screen.queryByText("新 API")).toBeNull();
    await user.click(screen.getByRole("button", { name: "编辑与调试" }));
    expect(push).toHaveBeenCalledWith("/admin/workflow-apis/published-id/edit");
  });

  it("opens publication controls with the chosen API and refreshes after management", async () => {
    vi.mocked(api.editorApi.getWorkflow).mockResolvedValue({
      id: "published-id",
      name: "商品海报 API",
      schemaVersion: 1,
      graph: {
        nodes: [],
        edges: [],
        externalApi: {
          schemaVersion: 1,
          inputs: [],
          outputs: [{ key: "poster", label: "海报", type: "image", nodeId: "output" }],
        },
      },
      createdAt: "2026-09-08T00:00:00Z",
      updatedAt: "2026-09-08T00:00:00Z",
    });
    const user = userEvent.setup();
    render(<WorkflowApiManagementPanel />);
    const name = await screen.findByText("商品海报 API");
    await user.click(within(name.closest("tr")!).getByRole("button", { name: "发布管理" }));
    const dialog = await screen.findByRole("dialog", { name: "发布管理" });
    expect(dialog).toHaveTextContent("published-id");
    expect(dialog).toHaveTextContent("poster");
    await user.click(within(dialog).getByRole("button", { name: "关闭发布管理" }));
    await waitFor(() => expect(api.listWorkflowApis).toHaveBeenCalledTimes(2));
  });

  it("creates an API draft and enters its editor", async () => {
    vi.mocked(api.editorApi.createWorkflow).mockResolvedValue({
      id: "new-id",
      name: "未命名 API",
      schemaVersion: 1,
      graph: null,
      createdAt: "2026-09-08T00:00:00Z",
      updatedAt: "2026-09-08T00:00:00Z",
    });
    const user = userEvent.setup();
    render(<WorkflowApiManagementPanel />);
    await user.click(screen.getByRole("button", { name: "新建 API" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/workflow-apis/new-id/edit"));
    expect(api.editorApi.createWorkflow).toHaveBeenCalledWith(
      "未命名 API",
      expect.objectContaining({ nodes: expect.any(Array) }),
    );
  });
});
