import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  WorkflowTemplateDocument,
  WorkflowTemplateSummary,
} from "@/features/workflow/templates-api";

const STRINGS: Record<string, string> = {
  "common.cancel": "Cancel",
  "common.loading": "Loading",
  "workflow.templateLibrary": "Template library",
  "workflow.templateLibraryDescription": "Pick a reusable workflow",
  "workflow.templateSearch": "Search templates",
  "workflow.allCategories": "All",
  "workflow.featuredTemplate": "Featured",
  "workflow.useTemplate": "Use template",
  "workflow.usingTemplate": "Creating",
  "workflow.templateName": "New workflow name",
  "workflow.templateEmpty": "No templates",
  "workflow.templateEmptyDescription": "No matching templates",
  "workflow.templateLoadFailed": "Load failed",
  "workflow.templateCreateFailed": "Create failed",
  "workflow.templateNoDescription": "No description",
  "workflow.chooseTemplate": "Choose a template",
  "workflow.nodeLibrary": "Nodes",
  "workflow.templateTextInputs": "Text inputs",
  "workflow.templateImageInputs": "Image inputs",
  "workflow.templatePreview": "Preview",
  "workflow.templateCopyHint": "Creates an independent copy",
};

vi.mock("@/components/providers/i18n-provider", () => ({
  useT: () => (key: string, values?: Record<string, unknown>) => {
    if (key === "workflow.nodeCount") return `${String(values?.count)} nodes`;
    if (key === "workflow.templateUses") return `${String(values?.count)} uses`;
    return STRINGS[key] ?? key;
  },
}));

vi.mock("@/features/workflow/templates-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/workflow/templates-api")>()),
  listWorkflowTemplates: vi.fn(),
  getWorkflowTemplate: vi.fn(),
  instantiateWorkflowTemplate: vi.fn(),
}));

const templateApi = await import("@/features/workflow/templates-api");
const { WorkflowTemplateLibraryDialog } =
  await import("@/features/workflow/template-library-dialog");

const summary: WorkflowTemplateSummary = {
  id: "template-id",
  name: "商品海报",
  description: "生成电商商品海报",
  category: "电商",
  tags: ["海报"],
  status: "published",
  version: 1,
  isFeatured: true,
  sortOrder: 10,
  useCount: 3,
  nodeCount: 3,
  textInputCount: 1,
  imageInputCount: 0,
  outputKinds: ["image"],
  updatedAt: "2026-08-20T00:00:00Z",
  publishedAt: "2026-08-20T00:00:00Z",
};

const templateDocument: WorkflowTemplateDocument = {
  ...summary,
  schemaVersion: 1,
  graph: {
    nodes: [
      { id: "prompt", type: "text", position: { x: 0, y: 0 }, data: { text: "" } },
      { id: "out", type: "imageOutput", position: { x: 300, y: 0 }, data: {} },
    ],
    edges: [],
  },
  createdAt: "2026-08-20T00:00:00Z",
};

describe("WorkflowTemplateLibraryDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(templateApi.listWorkflowTemplates).mockResolvedValue({ templates: [summary] });
    vi.mocked(templateApi.getWorkflowTemplate).mockResolvedValue(templateDocument);
  });

  it("loads a published template and creates a named workflow copy", async () => {
    const created = {
      id: "new-workflow",
      name: "秋季商品海报",
      schemaVersion: 1,
      graph: templateDocument.graph,
      createdAt: "2026-08-20T01:00:00Z",
      updatedAt: "2026-08-20T01:00:00Z",
    };
    vi.mocked(templateApi.instantiateWorkflowTemplate).mockResolvedValue(created);
    const onCreated = vi.fn();
    const user = userEvent.setup();

    render(<WorkflowTemplateLibraryDialog isOpen onOpenChange={vi.fn()} onCreated={onCreated} />);

    await screen.findByText("生成电商商品海报");
    const name = await screen.findByLabelText("New workflow name");
    // 列表先呈现、模板详情随后加载；等输入解锁后模拟用户编辑。
    await waitFor(() => expect(name).toBeEnabled());
    await user.clear(name);
    await user.type(name, "秋季商品海报");
    await user.click(screen.getByRole("button", { name: "Use template" }));

    await waitFor(() => {
      expect(templateApi.instantiateWorkflowTemplate).toHaveBeenCalledWith(
        "template-id",
        "秋季商品海报",
      );
    });
    expect(onCreated).toHaveBeenCalledWith(created);
  });
});
