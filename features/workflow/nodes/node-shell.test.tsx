import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkflowNodeShell } from "@/features/workflow/nodes/node-shell";
import { WorkflowPartialRerunPreviewProvider } from "@/features/workflow/partial-rerun-preview";
import type { WorkflowPartialRerunPreview } from "@/features/workflow/types";

vi.mock("@xyflow/react", () => ({
  Handle: ({ id }: { id: string }) => <span data-testid={`handle-${id}`} />,
  Position: { Left: "left", Right: "right" },
}));

vi.mock("@/components/providers/i18n-provider", () => ({
  useT: () => (key: string) => key,
}));

const preview: WorkflowPartialRerunPreview = {
  sourceRunId: "run-1",
  fromNodeId: "generate",
  reusedNodeIds: ["prompt"],
  rerunNodeIds: ["generate", "output"],
};

describe("workflow node partial rerun state", () => {
  it("shows the rerun start directly on the canvas node", () => {
    renderNode("generate");

    const shell = screen
      .getByText("workflow.statusRerunStart")
      .closest("[data-partial-rerun-state]");
    expect(shell).toHaveAttribute("data-partial-rerun-state", "start");
    expect(shell).toHaveAttribute("inert");
    expect(shell).toHaveClass("border-amber-500");
  });

  it("shows reused nodes with a lock state", () => {
    renderNode("prompt");

    const shell = screen
      .getByText("workflow.statusWillReuse")
      .closest("[data-partial-rerun-state]");
    expect(shell).toHaveAttribute("data-partial-rerun-state", "reuse");
    expect(shell).toHaveClass("border-emerald-500/80");
  });

  it("keeps the port inset outside a parameter node's scrolling content", () => {
    render(
      <WorkflowNodeShell
        nodeId="parameters"
        title="Parameters"
        icon={<span />}
        bodyClassName="pt-13"
      >
        <div data-testid="parameter-scroll" className="overflow-y-auto">
          Parameters
        </div>
      </WorkflowNodeShell>,
    );

    const content = screen.getByTestId("parameter-scroll");
    expect(content.parentElement).toHaveClass("pt-13");
    expect(content).not.toHaveClass("pt-13");
  });
});

function renderNode(nodeId: string) {
  return render(
    <WorkflowPartialRerunPreviewProvider
      sourceNodeIds={new Set(["prompt", "generate", "output"])}
      preview={preview}
    >
      <WorkflowNodeShell nodeId={nodeId} title="Node" icon={<span />}>
        <div />
      </WorkflowNodeShell>
    </WorkflowPartialRerunPreviewProvider>,
  );
}
