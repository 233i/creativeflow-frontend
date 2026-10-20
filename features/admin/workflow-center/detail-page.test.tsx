import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState, type ReactNode } from "react";
import { WorkflowDetailPage } from "./detail-page";
import { useEditorSession, WorkflowDetailHeader } from "./detail-context";

const data = vi.hoisted(() => {
  const id = "10000000-0000-4000-8000-000000000001";
  const document = {
    id,
    name: "合成工作流",
    schemaVersion: 1,
    graph: { schemaVersion: 1 as const, nodes: [], edges: [] },
    createdAt: "2026-09-13T00:00:00Z",
    updatedAt: "2026-09-13T00:00:00Z",
  };
  return {
    document,
    push: vi.fn(),
    save: vi.fn(),
    prepare: vi.fn(),
    getMe: vi.fn(),
    template: vi.fn(),
    publish: vi.fn(),
    deletedAt: null as string | null,
    preview: vi.fn(),
    remove: vi.fn(),
    getWorkflow: vi.fn(),
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: data.push }) }));
vi.mock("../api", () => ({
  getMe: data.getMe,
  logout: vi.fn(),
  getWorkflowTemplate: data.template,
  updateWorkflowTemplate: vi.fn(),
  publishWorkflowTemplate: data.publish,
  archiveWorkflowTemplate: vi.fn(),
}));
vi.mock("../workflow-api", () => ({ editorApi: { getWorkflow: data.getWorkflow } }));
vi.mock("./api", () => ({
  previewWorkflowDeletion: data.preview,
  deleteManagedWorkflow: data.remove,
  listWorkflowCenter: vi.fn(async () => ({
    items: [
      {
        id: data.document.id,
        name: data.document.name,
        source: "workflow",
        schemaVersion: 1,
        kind: "general",
        deletedAt: data.deletedAt,
      },
    ],
    total: 1,
  })),
}));
vi.mock("../admin-login", () => ({ AdminLogin: () => <h1>登录管理后台</h1> }));
vi.mock("../admin-shell", () => ({
  AdminShell: ({
    children,
    onTabChange,
  }: {
    children: ReactNode;
    onTabChange: (tab: string) => void;
  }) => (
    <main>
      <button onClick={() => onTabChange("workflows")}>离开到中心</button>
      {children}
    </main>
  ),
}));
vi.mock("@/features/workflow/readonly-graph", () => ({
  ReadonlyWorkflowGraph: () => <p>历史模板只读图</p>,
}));
vi.mock("./run-records", () => ({ WorkflowRunRecords: () => <p>运行摘要列表</p> }));
vi.mock("@/features/workflow/external-api/publish-panel", () => ({
  WorkflowPublishPanel: () => <p>页面式发布管理</p>,
}));
vi.mock("@/features/workflow/workflow-page", () => ({
  WorkflowApiEditorPage: FakeEditor,
  WorkflowTemplateEditorPage: () => {
    data.prepare();
    return <p>模板编辑器</p>;
  },
}));

function FakeEditor() {
  const [document, setDocument] = useState(data.document);
  const [dirty, setDirty] = useState(false);
  useEditorSession(document, document.graph, dirty, false, async () => {
    const success = await data.save();
    if (success) setDirty(false);
    return success;
  });
  return (
    <>
      <WorkflowDetailHeader>
        <header>
          <label>
            编辑草稿
            <input
              value={document.name}
              onChange={(event) => {
                setDocument({ ...document, name: event.target.value });
                setDirty(true);
              }}
            />
          </label>
          <p>{dirty ? "草稿未保存" : "草稿已保存"}</p>
        </header>
      </WorkflowDetailHeader>
      <p style={{ visibility: "visible" }}>保留挂载的画布</p>
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  data.save.mockResolvedValue(true);
  data.deletedAt = null;
  data.getWorkflow.mockResolvedValue(data.document);
  data.remove.mockResolvedValue(undefined);
  data.preview.mockResolvedValue({
    id: data.document.id,
    source: "workflow",
    name: data.document.name,
    revision: "123",
    deletedAt: null,
    canDelete: true,
    publishedApis: 0,
    publishedTemplates: 0,
    queuedRuns: 0,
    runningRuns: 0,
    historyRuns: 0,
    deploymentVersions: 0,
    apiKeys: 0,
    independentCopies: 0,
  });
  data.getMe.mockResolvedValue({
    admin: { id: "admin", username: "合成管理员", mustChangePassword: false },
  });
  data.template.mockResolvedValue({
    ...data.document,
    status: "published",
    version: 1,
    description: "合成资料",
    tags: [],
    category: "合成",
    publishedAt: data.document.updatedAt,
  });
  window.history.replaceState(
    null,
    "",
    `/admin/workflows/${data.document.id}/edit?source=workflow&returnTo=%2Fadmin%2Fworkflows%3Fpage%3D2`,
  );
});

describe("workflow detail preserves original business semantics", () => {
  it("deletes from settings after explicit confirmation, discards unsaved edits and returns to the same filtered list", async () => {
    const user = userEvent.setup();
    render(<WorkflowDetailPage id={data.document.id} source="workflow" initialSection="edit" />);
    await user.type(await screen.findByRole("textbox", { name: "编辑草稿" }), " 未保存");
    await user.click(screen.getByRole("button", { name: "基本设置" }));
    await user.click(screen.getByRole("button", { name: "删除工作流" }));
    expect(await screen.findByText(/确认删除将一并放弃/)).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: "确认工作流名称" }), data.document.name);
    await user.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(data.push).toHaveBeenCalledWith("/admin/workflows?page=2"));
    expect(data.remove).toHaveBeenCalledOnce();
    expect(data.save).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "处理未保存修改" })).not.toBeInTheDocument();
  });

  it("opens deleted resources as read-only history without mounting an editor or querying a draft", async () => {
    data.deletedAt = "2026-09-19T02:00:00Z";
    render(<WorkflowDetailPage id={data.document.id} source="workflow" initialSection="edit" />);
    expect(await screen.findByText(/不能重新执行、编辑或发布/)).toBeVisible();
    expect(screen.getByText("运行摘要列表")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "编辑草稿" })).not.toBeInTheDocument();
    expect(data.getWorkflow).not.toHaveBeenCalled();
    expect(data.prepare).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "删除工作流" })).not.toBeInTheDocument();
  });

  it("retains an unsaved editor across page tabs without saving or publishing", async () => {
    const user = userEvent.setup();
    render(<WorkflowDetailPage id={data.document.id} source="workflow" initialSection="edit" />);
    await user.type(await screen.findByRole("textbox", { name: "编辑草稿" }), " 未保存内容");
    await user.click(screen.getByRole("button", { name: "发布与版本" }));
    expect(await screen.findByText("页面式发布管理")).toBeVisible();
    expect(window.location.pathname).toContain("/publications");
    expect(screen.queryByRole("textbox", { name: "编辑草稿" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "编排与调试" }));
    expect(screen.getByRole("textbox", { name: "编辑草稿" })).toHaveValue("合成工作流 未保存内容");
    expect(data.save).not.toHaveBeenCalled();
    expect(data.publish).not.toHaveBeenCalled();
  });

  it("hides the mounted canvas even when its nodes explicitly set visibility to visible", async () => {
    const user = userEvent.setup();
    render(<WorkflowDetailPage id={data.document.id} source="workflow" initialSection="edit" />);
    await user.type(await screen.findByRole("textbox", { name: "编辑草稿" }), " 保留修改");
    const canvas = screen.getByText("保留挂载的画布");

    for (const tab of ["运行记录", "发布与版本", "访问权限", "基本设置"]) {
      await user.click(screen.getByRole("button", { name: tab }));
      expect(canvas).toBeInTheDocument();
      // React Flow 的内联 visibility 会覆盖继承值；整棵子树必须退出布局和绘制。
      expect(canvas.closest("[hidden]")).not.toBeNull();
      expect(canvas).not.toBeVisible();
      await user.click(screen.getByRole("button", { name: "编排与调试" }));
      expect(screen.getByText("保留挂载的画布")).toBe(canvas);
      expect(canvas).toBeVisible();
      expect(screen.getByRole("textbox", { name: "编辑草稿" })).toHaveValue("合成工作流 保留修改");
    }
    expect(data.save).not.toHaveBeenCalled();
    expect(data.publish).not.toHaveBeenCalled();
  });

  it("keeps the canvas hidden when a non-editor tab is the initial route", async () => {
    window.history.replaceState(
      null,
      "",
      `/admin/workflows/${data.document.id}/runs?source=workflow`,
    );
    const user = userEvent.setup();
    render(<WorkflowDetailPage id={data.document.id} source="workflow" initialSection="runs" />);
    expect(await screen.findByText("运行摘要列表")).toBeVisible();
    const canvas = await screen.findByText("保留挂载的画布");
    expect(canvas.closest("[hidden]")).not.toBeNull();
    expect(canvas).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: "返回编排" }));
    expect(screen.getByText("保留挂载的画布")).toBe(canvas);
    expect(canvas).toBeVisible();
  });

  it("stays on a failed save and only leaves after an explicit discard", async () => {
    data.save.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<WorkflowDetailPage id={data.document.id} source="workflow" initialSection="edit" />);
    await user.type(await screen.findByRole("textbox", { name: "编辑草稿" }), " 修改");
    await user.click(screen.getByRole("button", { name: "离开到中心" }));
    const dialog = await screen.findByRole("dialog", { name: "处理未保存修改" });
    await user.click(within(dialog).getByRole("button", { name: "保存后离开" }));
    await waitFor(() => expect(data.save).toHaveBeenCalledOnce());
    expect(data.push).not.toHaveBeenCalled();
    expect(dialog).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "放弃修改并离开" }));
    expect(data.push).toHaveBeenCalledExactlyOnceWith("/admin?tab=workflows");
  });

  it("views a published historical template without preparing or mutating a debug workflow", async () => {
    render(<WorkflowDetailPage id={data.document.id} source="template" initialSection="edit" />);
    expect(await screen.findByText("历史模板只读图")).toBeVisible();
    expect(screen.getByText(/只读版本/)).toBeVisible();
    expect(data.prepare).not.toHaveBeenCalled();
    expect(data.publish).not.toHaveBeenCalled();
  });

  it("unmounts restricted editor data when the administrator session expires", async () => {
    render(<WorkflowDetailPage id={data.document.id} source="workflow" initialSection="edit" />);
    await screen.findByRole("textbox", { name: "编辑草稿" });
    data.getMe.mockResolvedValue({ admin: null });
    fireEvent(document, new Event("visibilitychange"));
    expect(await screen.findByRole("heading", { name: "登录管理后台" })).toBeVisible();
    expect(screen.queryByText("保留挂载的画布")).not.toBeInTheDocument();
  });

  it("intercepts browser traversal before discarding a dirty workflow", async () => {
    const user = userEvent.setup();
    render(<WorkflowDetailPage id={data.document.id} source="workflow" initialSection="edit" />);
    await user.type(await screen.findByRole("textbox", { name: "编辑草稿" }), " 未保存");
    // JSDOM 的真实 traversal 由异步测试环境实现，模拟其先换 URL 后派发事件的浏览器语义。
    window.history.replaceState(null, "", "/admin/workflows?page=2");
    fireEvent(window, new PopStateEvent("popstate"));
    const dialog = await screen.findByRole("dialog", { name: "处理未保存修改" });
    expect(window.location.pathname).toContain(data.document.id);
    expect(data.push).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "继续编辑" }));
    expect(screen.getByRole("textbox", { name: "编辑草稿" })).toHaveValue("合成工作流 未保存");
    expect(data.save).not.toHaveBeenCalled();
  });
});
