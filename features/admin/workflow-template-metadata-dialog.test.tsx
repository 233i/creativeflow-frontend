import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowTemplateDocument } from "@/features/workflow/templates-api";

const mocks = vi.hoisted(() => ({
  updateWorkflowTemplate: vi.fn(),
}));

vi.mock("@/features/admin/api", () => ({
  AdminApiError: class AdminApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
      readonly details: string[] = [],
    ) {
      super(message);
    }
  },
  updateWorkflowTemplate: mocks.updateWorkflowTemplate,
}));

const { WorkflowTemplateMetadataDialog } =
  await import("@/features/admin/workflow-template-metadata-dialog");

const template: WorkflowTemplateDocument = {
  id: "template-id",
  name: "商品海报",
  description: "旧描述",
  category: "电商",
  tags: ["海报"],
  schemaVersion: 1,
  graph: { nodes: [], edges: [] },
  status: "draft",
  version: 1,
  isFeatured: false,
  sortOrder: 0,
  useCount: 0,
  createdAt: "2026-08-20T00:00:00Z",
  updatedAt: "2026-08-20T00:00:00Z",
  publishedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateWorkflowTemplate.mockResolvedValue({
    ...template,
    name: "短视频封面",
  });
});

describe("WorkflowTemplateMetadataDialog", () => {
  it("updates template library metadata without sending the graph", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <WorkflowTemplateMetadataDialog
        template={template}
        isOpen
        onOpenChange={onOpenChange}
        onSaved={onSaved}
      />,
    );

    await user.clear(screen.getByLabelText("模板名称*"));
    await user.type(screen.getByLabelText("模板名称*"), "短视频封面");
    await user.clear(screen.getByLabelText("标签"));
    await user.type(screen.getByLabelText("标签"), "视频，封面");
    await user.click(screen.getByLabelText("在前台模板库中推荐展示"));
    await user.click(screen.getByRole("button", { name: "保存信息" }));

    await waitFor(() => {
      expect(mocks.updateWorkflowTemplate).toHaveBeenCalledWith("template-id", {
        name: "短视频封面",
        description: "旧描述",
        category: "电商",
        tags: ["视频", "封面"],
        isFeatured: true,
        sortOrder: 0,
      });
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: "短视频封面" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
