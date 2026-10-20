import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
// 仅用于类型：运行时绑定来自下方模拟的动态导入，后者不能作为类型命名空间使用。
import type { CanvasDocument, CanvasSummary } from "@/features/canvas/api";

/**
 * 项目菜单行为。
 *
 * 这里覆盖一旦处理错误便会丢失工作或让用户无法继续操作的场景：删除当前打开的项目、
 * 删除最后一个项目，以及重命名被触发两次。
 */

const STRINGS: Record<string, string> = {
  "canvas.defaultProject": "我的画布",
  "canvas.newProject": "新建项目",
  "canvas.projectRename": "重命名",
  "canvas.projectDelete": "删除项目",
  "projects.create": "创建项目",
};

vi.mock("@/components/providers/i18n-provider", () => ({
  useT: () => (key: string) => STRINGS[key] ?? key,
}));

// 实际组件是通过 Portal 渲染的 react-aria 模态框。使用替代实现可让测试聚焦于菜单自身的删除逻辑，
// 而不是对话框渲染。
vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({ isOpen, onConfirm }: { isOpen: boolean; onConfirm: () => void }) =>
    isOpen ? (
      <button type="button" onClick={() => void onConfirm()}>
        confirm
      </button>
    ) : null,
}));

// 只模拟网络调用；`summarize` 保持真实实现，因为将新建文档转换为列表条目也是测试内容之一。
vi.mock("@/features/canvas/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/canvas/api")>()),
  listCanvases: vi.fn(),
  createCanvas: vi.fn(),
  renameCanvas: vi.fn(),
  deleteCanvas: vi.fn(),
}));

vi.mock("@/features/workflow/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/workflow/api")>()),
  listWorkflows: vi.fn().mockResolvedValue({ workflows: [] }),
  createWorkflow: vi.fn(),
}));

const api = await import("@/features/canvas/api");
const { ProjectMenu } = await import("@/features/canvas/project-menu");
const { loadLocal, saveLocal } = await import("@/features/canvas/persistence");

function summary(id: string, name: string, nodeCount = 0): CanvasSummary {
  return {
    id,
    name,
    nodeCount,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function document(id: string, name: string): CanvasDocument {
  return {
    id,
    name,
    graph: { nodes: [], edges: [] },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const switched = vi.fn();

/** 按画布页面的方式保存列表和当前打开的 ID，使菜单保持受控。 */
function Harness({ initial }: { initial: CanvasSummary[] }) {
  const [projects, setProjects] = useState(initial);
  const [currentId, setCurrentId] = useState(initial[0].id);

  return (
    <ProjectMenu
      currentId={currentId}
      projects={projects}
      onProjectsChange={setProjects}
      onSwitch={(id) => {
        setCurrentId(id);
        switched(id);
      }}
    />
  );
}

/** 渲染时直接打开菜单列表，因为每个测试场景都会操作列表项。 */
async function openMenu(initial: CanvasSummary[]) {
  vi.mocked(api.listCanvases).mockResolvedValue({ canvases: initial });

  const user = userEvent.setup();
  render(<Harness initial={initial} />);

  await user.click(screen.getByRole("button", { expanded: false }));
  // 菜单打开时会刷新列表，等待刷新完成后再操作列表项。
  await waitFor(() => expect(api.listCanvases).toHaveBeenCalled());

  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("ProjectMenu", () => {
  it("opens the project that was clicked", async () => {
    const user = await openMenu([summary("a", "A"), summary("b", "B")]);

    await user.click(screen.getByText("B"));

    expect(switched).toHaveBeenCalledWith("b");
  });

  it("gives each new project a name that does not collide with an existing one", async () => {
    // 过去连续三次点击“新建项目”会产生三个同名条目，列表本身无法区分它们。
    const user = await openMenu([summary("a", "我的画布")]);
    vi.mocked(api.createCanvas).mockResolvedValue(document("b", "我的画布 2"));

    await user.click(screen.getByText("新建项目"));
    await user.click(screen.getByRole("button", { name: "创建项目" }));

    await waitFor(() => expect(api.createCanvas).toHaveBeenCalledWith("我的画布 2"));
    await waitFor(() => expect(switched).toHaveBeenCalledWith("b"));
  });

  it("sends a rename once, not twice, when Enter commits the field", async () => {
    // 按 Enter 会卸载输入框，而卸载仍有焦点的输入框会触发 blur；过去这会再次提交并发送第二个请求。
    const user = await openMenu([summary("a", "A")]);
    vi.mocked(api.renameCanvas).mockResolvedValue(document("a", "renamed"));

    await user.click(screen.getByRole("button", { name: "重命名" }));
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "renamed{Enter}");

    await waitFor(() => expect(api.renameCanvas).toHaveBeenCalledExactlyOnceWith("a", "renamed"));
    // 应有两处：列表项，以及显示当前项目名称的触发按钮。
    await waitFor(() => expect(screen.getAllByText("renamed")).toHaveLength(2));
  });

  it("keeps the old name when the rename is abandoned with Escape", async () => {
    const user = await openMenu([summary("a", "A")]);

    await user.click(screen.getByRole("button", { name: "重命名" }));
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "discarded{Escape}");

    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    expect(screen.getAllByText("A")).toHaveLength(2);
    expect(api.renameCanvas).not.toHaveBeenCalled();
  });

  it("stays on the open project when a different one is deleted", async () => {
    const user = await openMenu([summary("a", "A"), summary("b", "B")]);
    vi.mocked(api.deleteCanvas).mockResolvedValue(undefined);

    await user.click(screen.getAllByRole("button", { name: "删除项目" })[1]);
    await user.click(await screen.findByText("confirm"));

    await waitFor(() => expect(api.deleteCanvas).toHaveBeenCalledWith("b"));
    expect(switched).not.toHaveBeenCalled();
  });

  it("moves to a remaining project when the open one is deleted", async () => {
    const user = await openMenu([summary("a", "A"), summary("b", "B")]);
    vi.mocked(api.deleteCanvas).mockResolvedValue(undefined);

    await user.click(screen.getAllByRole("button", { name: "删除项目" })[0]);
    await user.click(await screen.findByText("confirm"));

    await waitFor(() => expect(switched).toHaveBeenCalledWith("b"));
    expect(api.createCanvas).not.toHaveBeenCalled();
  });

  it("creates a default project when the last one is deleted", async () => {
    // 否则编辑器将没有可打开的项目，而负责创建替代项目的初始化逻辑只会在加载时运行。
    const user = await openMenu([summary("a", "A")]);
    vi.mocked(api.deleteCanvas).mockResolvedValue(undefined);
    vi.mocked(api.createCanvas).mockResolvedValue(document("fresh", "我的画布"));

    await user.click(screen.getByRole("button", { name: "删除项目" }));
    await user.click(await screen.findByText("confirm"));

    await waitFor(() => expect(api.createCanvas).toHaveBeenCalledWith("我的画布"));
    expect(switched).toHaveBeenCalledWith("fresh");
  });

  it("drops the local cache of a deleted project", async () => {
    // 否则缓存图会在服务端记录删除后继续存在，并一直留在 localStorage 中，直到浏览器数据被清理。
    saveLocal("b", [{ id: "n", type: "text", position: { x: 0, y: 0 }, data: {} }], []);

    const user = await openMenu([summary("a", "A"), summary("b", "B")]);
    vi.mocked(api.deleteCanvas).mockResolvedValue(undefined);

    await user.click(screen.getAllByRole("button", { name: "删除项目" })[1]);
    await user.click(await screen.findByText("confirm"));

    await waitFor(() => expect(loadLocal("b")).toBeNull());
  });

  it("keeps the list usable when a delete fails", async () => {
    const user = await openMenu([summary("a", "A"), summary("b", "B")]);
    vi.mocked(api.deleteCanvas).mockRejectedValue(new Error("network is down"));

    await user.click(screen.getAllByRole("button", { name: "删除项目" })[1]);
    await user.click(await screen.findByText("confirm"));

    // 菜单会重新打开并显示失败，而不是乐观地移除列表项。
    await user.click(screen.getByRole("button", { expanded: false }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("network is down"));
    expect(screen.getByText("B")).toBeInTheDocument();
  });
});
