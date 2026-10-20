import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteWorkflowDialog } from "./delete-dialog";
import type { WorkflowDeletionPreview } from "./api";

const api = vi.hoisted(() => ({ preview: vi.fn(), remove: vi.fn() }));
vi.mock("./api", () => ({
  previewWorkflowDeletion: api.preview,
  deleteManagedWorkflow: api.remove,
}));
const target = {
  id: "10000000-0000-4000-8000-000000000001",
  source: "workflow" as const,
  name: "合成工作流",
};
const initial: WorkflowDeletionPreview = {
  ...target,
  revision: "123",
  deletedAt: null,
  canDelete: true,
  publishedApis: 0,
  publishedTemplates: 0,
  queuedRuns: 0,
  runningRuns: 0,
  historyRuns: 12,
  deploymentVersions: 2,
  apiKeys: 3,
  independentCopies: 4,
};
const callbacks = () => ({ onClose: vi.fn(), onDeleted: vi.fn(), onNavigate: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  api.preview.mockResolvedValue(initial);
  api.remove.mockResolvedValue(undefined);
});

describe("protected workflow deletion", () => {
  it("queries before confirming, shows retained impact, requires the exact name and submits once", async () => {
    const user = userEvent.setup();
    const props = callbacks();
    render(<DeleteWorkflowDialog target={target} {...props} hasUnsavedChanges />);
    expect(screen.getByRole("button", { name: "确认删除" })).toBeDisabled();
    const input = await screen.findByRole("textbox", { name: "确认工作流名称" });
    expect(screen.getByText("12 条")).toBeVisible();
    expect(screen.getByText(/确认删除将一并放弃/)).toBeVisible();
    expect(api.remove).not.toHaveBeenCalled();
    await user.type(input, "合成");
    expect(screen.getByRole("button", { name: "确认删除" })).toBeDisabled();
    await user.clear(input);
    await user.type(input, target.name);
    await user.dblClick(screen.getByRole("button", { name: "确认删除" }));
    expect(api.remove).toHaveBeenCalledWith(target, target.name, "123");
    expect(api.remove).toHaveBeenCalledOnce();
    expect(props.onDeleted).toHaveBeenCalledOnce();
  });

  it("does not delete when cancelled", async () => {
    const user = userEvent.setup();
    const props = callbacks();
    render(<DeleteWorkflowDialog target={target} {...props} />);
    await screen.findByRole("textbox", { name: "确认工作流名称" });
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(api.remove).not.toHaveBeenCalled();
  });

  it("blocks published APIs, templates, queued and running work and links to the remedy without mutating", async () => {
    api.preview.mockResolvedValue({
      ...initial,
      canDelete: false,
      publishedApis: 1,
      publishedTemplates: 1,
      queuedRuns: 2,
      runningRuns: 3,
    });
    const user = userEvent.setup();
    const props = callbacks();
    render(<DeleteWorkflowDialog target={target} {...props} />);
    expect(await screen.findByText("暂时不能删除")).toBeVisible();
    expect(screen.getByText(/2 个排队任务、3 个运行任务/)).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认删除" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "前往发布与版本" }));
    expect(props.onNavigate).toHaveBeenCalledWith("publications");
    await user.click(screen.getByRole("button", { name: "查看运行记录" }));
    expect(props.onNavigate).toHaveBeenCalledWith("runs");
    expect(api.remove).not.toHaveBeenCalled();
  });

  it("queries explicitly after a failed preview and uses the server name instead of stale list metadata", async () => {
    api.preview.mockRejectedValueOnce(new Error("管理员会话已失效"));
    const user = userEvent.setup();
    render(<DeleteWorkflowDialog target={target} {...callbacks()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("管理员会话已失效");
    expect(screen.getByRole("button", { name: "确认删除" })).toBeDisabled();
    api.preview.mockResolvedValue({ ...initial, name: "最新名称", revision: "124" });
    await user.click(screen.getByRole("button", { name: "重新查询" }));
    await user.type(await screen.findByRole("textbox", { name: "确认工作流名称" }), "最新名称");
    await user.click(screen.getByRole("button", { name: "确认删除" }));
    expect(api.remove).toHaveBeenCalledWith(target, "最新名称", "124");
  });

  it("never retries an uncertain deletion and resolves lost responses through a read-only query", async () => {
    api.remove.mockRejectedValueOnce(new Error("网络中断"));
    const user = userEvent.setup();
    const props = callbacks();
    render(<DeleteWorkflowDialog target={target} {...props} />);
    await user.type(await screen.findByRole("textbox", { name: "确认工作流名称" }), target.name);
    await user.click(screen.getByRole("button", { name: "确认删除" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("不会自动重试删除");
    expect(props.onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "确认删除" })).toBeDisabled();
    api.preview.mockResolvedValue({
      ...initial,
      deletedAt: "2026-09-19T01:00:00Z",
      canDelete: false,
    });
    await user.click(screen.getByRole("button", { name: "重新查询" }));
    await waitFor(() => expect(props.onDeleted).toHaveBeenCalledOnce());
    expect(api.remove).toHaveBeenCalledOnce();
  });

  it("requires a fresh preview and confirmation after a version conflict", async () => {
    api.remove.mockRejectedValueOnce(new Error("工作流已被修改"));
    const user = userEvent.setup();
    render(<DeleteWorkflowDialog target={target} {...callbacks()} />);
    await user.type(await screen.findByRole("textbox", { name: "确认工作流名称" }), target.name);
    await user.click(screen.getByRole("button", { name: "确认删除" }));
    await screen.findByRole("alert");
    api.preview.mockResolvedValue({ ...initial, revision: "125" });
    await user.click(screen.getByRole("button", { name: "重新查询" }));
    expect(await screen.findByRole("textbox", { name: "确认工作流名称" })).toHaveValue("");
    expect(api.remove).toHaveBeenCalledOnce();
  });

  it("disables confirmation and dismissal while the request is pending", async () => {
    let finish!: () => void;
    api.remove.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const user = userEvent.setup();
    const props = callbacks();
    render(<DeleteWorkflowDialog target={target} {...props} />);
    await user.type(await screen.findByRole("textbox", { name: "确认工作流名称" }), target.name);
    await user.dblClick(screen.getByRole("button", { name: "确认删除" }));
    expect(api.remove).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "删除中…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(props.onClose).not.toHaveBeenCalled();
    finish();
    await waitFor(() => expect(props.onDeleted).toHaveBeenCalledOnce());
  });
});
