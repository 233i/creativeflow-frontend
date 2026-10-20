import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { WorkflowPartialRerunControls } from "@/features/workflow/run-progress-panel";
import type { WorkflowRun } from "@/features/workflow/types";

vi.mock("@xyflow/react", () => ({
  useReactFlow: () => ({
    getNode: () => undefined,
    getZoom: () => 1,
    setCenter: vi.fn(),
  }),
}));

vi.mock("@/components/providers/i18n-provider", () => ({
  useT: () => (key: string) => key,
}));

const { WorkflowRunProgressPanel } = await import("@/features/workflow/run-progress-panel");

function failedRun(): WorkflowRun {
  return {
    id: "run-2",
    workflowId: "workflow-1",
    resumedFromRunId: "run-1",
    status: "failed",
    error: "generation failed",
    createdAt: "2026-08-19T00:00:00.000Z",
    updatedAt: "2026-08-19T00:00:02.000Z",
    startedAt: "2026-08-19T00:00:00.000Z",
    finishedAt: "2026-08-19T00:00:02.000Z",
    nodes: [
      {
        nodeId: "text-1",
        nodeType: "text",
        status: "succeeded",
        isReused: true,
        progress: 1,
        output: { texts: ["prompt"] },
        error: null,
        startedAt: "2026-08-18T00:00:00.000Z",
        finishedAt: "2026-08-18T00:00:01.000Z",
      },
      {
        nodeId: "video-1",
        nodeType: "videoGenerate",
        status: "failed",
        isReused: false,
        progress: null,
        output: null,
        error: "generation failed",
        startedAt: "2026-08-19T00:00:01.000Z",
        finishedAt: "2026-08-19T00:00:02.000Z",
      },
    ],
  };
}

function succeededRun(): WorkflowRun {
  return {
    ...failedRun(),
    id: "run-success",
    resumedFromRunId: null,
    status: "succeeded",
    error: null,
    nodes: [
      failedRun().nodes[0],
      {
        ...failedRun().nodes[1],
        status: "succeeded",
        output: { videos: ["/api/v1/canvas/assets/video-1"] },
        error: null,
      },
    ],
  };
}

function partialRerunControls(
  overrides: Partial<WorkflowPartialRerunControls> = {},
): WorkflowPartialRerunControls {
  return {
    selecting: false,
    preview: null,
    previewPendingNodeId: null,
    error: null,
    onBegin: vi.fn(),
    onChoose: vi.fn(),
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
}

describe("workflow failure recovery actions", () => {
  it("shows continue and full restart actions and reports reused nodes", async () => {
    const user = userEvent.setup();
    const onResume = vi.fn();
    const onRestart = vi.fn();

    render(
      <WorkflowRunProgressPanel
        run={failedRun()}
        actionPending={null}
        onResume={onResume}
        onRestart={onRestart}
        partialRerun={partialRerunControls()}
      />,
    );

    expect(screen.getByText(/workflow\.statusReused/)).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "workflow.resumeRun" })[0]);
    await user.click(screen.getAllByRole("button", { name: "workflow.restartRun" })[0]);

    expect(onResume).toHaveBeenCalledOnce();
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it("disables both choices while a recovery request is pending", () => {
    render(
      <WorkflowRunProgressPanel
        run={failedRun()}
        actionPending="resume"
        onResume={vi.fn()}
        onRestart={vi.fn()}
        partialRerun={partialRerunControls()}
      />,
    );

    for (const button of screen.getAllByRole("button", {
      name: /workflow\.(resumeRun|restartRun)/,
    })) {
      expect(button).toBeDisabled();
    }
  });
});

describe("workflow partial rerun actions", () => {
  it("previews the dependency range before starting from the selected node", async () => {
    const user = userEvent.setup();
    const preview = {
      sourceRunId: "run-success",
      fromNodeId: "video-1",
      reusedNodeIds: ["text-1"],
      rerunNodeIds: ["video-1"],
    };
    const onBegin = vi.fn();
    const onChoose = vi.fn();
    const onConfirm = vi.fn();

    const view = render(
      <WorkflowRunProgressPanel
        run={succeededRun()}
        actionPending={null}
        onResume={vi.fn()}
        onRestart={vi.fn()}
        partialRerun={partialRerunControls({ onBegin })}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: "workflow.partialRerun" })[0]);
    expect(onBegin).toHaveBeenCalledOnce();

    view.rerender(
      <WorkflowRunProgressPanel
        run={succeededRun()}
        actionPending={null}
        onResume={vi.fn()}
        onRestart={vi.fn()}
        partialRerun={partialRerunControls({
          selecting: true,
          preview,
          onChoose,
          onConfirm,
        })}
      />,
    );

    await user.click(
      screen.getAllByRole("button", {
        name: "workflow.partialRerunFromNode",
      })[1],
    );

    expect(onChoose).toHaveBeenCalledWith("video-1");
    const confirm = await screen.findAllByRole("button", {
      name: "workflow.partialRerunConfirm",
    });
    await user.click(confirm[0]);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
