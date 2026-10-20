import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const STRINGS: Record<string, string> = {
  "canvas.defaultProject": "我的画布",
  "workflow.defaultProject": "我的工作流",
  "projects.canvasTitle": "创意画板",
  "projects.workflowTitle": "自动化工作流",
  "projects.create": "创建项目",
  "workflow.createBlank": "创建空白工作流",
};

vi.mock("@/components/providers/i18n-provider", () => ({
  useT: () => (key: string) => STRINGS[key] ?? key,
}));

vi.mock("@/features/canvas/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/canvas/api")>()),
  createCanvas: vi.fn(),
}));

vi.mock("@/features/workflow/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/workflow/api")>()),
  createWorkflow: vi.fn(),
  getWorkflowCapabilities: vi.fn().mockResolvedValue({ enabled: false, nodeTypes: [] }),
}));

const canvasApi = await import("@/features/canvas/api");
const workflowApi = await import("@/features/workflow/api");
const { CreateProjectDialog } = await import("@/features/projects/create-project-dialog");

describe("CreateProjectDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(workflowApi.getWorkflowCapabilities).mockResolvedValue({
      enabled: false,
      nodeTypes: [],
    });
  });

  it("shows the enabled AI workflow entry and creates a separate v2 document", async () => {
    vi.mocked(workflowApi.getWorkflowCapabilities).mockResolvedValue({
      enabled: true,
      nodeTypes: ["start", "llm", "end"],
    });
    vi.mocked(workflowApi.createWorkflow).mockResolvedValue({
      id: "new-workflow",
      name: "AI 工作流",
      schemaVersion: 1,
      graph: null,
      createdAt: "2026-09-12",
      updatedAt: "2026-09-12",
    });
    const created = vi.fn();
    const user = userEvent.setup();
    render(
      <CreateProjectDialog
        isOpen
        onOpenChange={vi.fn()}
        onCanvasCreated={vi.fn()}
        onWorkflowCreated={created}
      />,
    );
    await user.click(await screen.findByRole("button", { name: /^AI 工作流/ }));
    await user.click(screen.getByRole("button", { name: "创建项目" }));
    await waitFor(() => expect(created).toHaveBeenCalledOnce());
    expect(workflowApi.createWorkflow).toHaveBeenCalledWith(
      "AI 工作流",
      expect.objectContaining({ schemaVersion: 1 }),
    );
  });

  it("does not advertise disabled or unavailable node capabilities", async () => {
    render(
      <CreateProjectDialog
        isOpen
        onOpenChange={vi.fn()}
        onCanvasCreated={vi.fn()}
        onWorkflowCreated={vi.fn()}
      />,
    );
    await waitFor(() => expect(workflowApi.getWorkflowCapabilities).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /^AI 工作流/ })).not.toBeInTheDocument();
  });

  it("creates a separate starter workflow when workflow mode is selected", async () => {
    const created = {
      id: "workflow-id",
      name: "我的工作流",
      schemaVersion: 1,
      graph: { nodes: [], edges: [] },
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    vi.mocked(workflowApi.createWorkflow).mockResolvedValue(created);
    const onWorkflowCreated = vi.fn();
    const user = userEvent.setup();

    render(
      <CreateProjectDialog
        isOpen
        onOpenChange={vi.fn()}
        onCanvasCreated={vi.fn()}
        onWorkflowCreated={onWorkflowCreated}
      />,
    );

    await user.click(screen.getByText("自动化工作流"));
    await user.click(screen.getByRole("button", { name: "创建空白工作流" }));

    await waitFor(() => expect(workflowApi.createWorkflow).toHaveBeenCalledOnce());
    const [name, graph] = vi.mocked(workflowApi.createWorkflow).mock.calls[0];
    expect(name).toBe("我的工作流");
    expect(graph.nodes.map((node) => node.type)).toEqual(["text", "imageGenerate", "imageOutput"]);
    expect(graph.edges).toHaveLength(2);
    expect(canvasApi.createCanvas).not.toHaveBeenCalled();
    expect(onWorkflowCreated).toHaveBeenCalledWith(created);
  });
});
