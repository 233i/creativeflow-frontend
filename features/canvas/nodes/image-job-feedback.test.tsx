import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageNodeData } from "../types";

const actions = vi.hoisted(() => ({
  queryImageJob: vi.fn(),
  retryImageDownload: vi.fn(),
  regenerateImageJob: vi.fn(),
}));
vi.mock("@/features/canvas/image-jobs", () => actions);
vi.mock("@/components/providers/i18n-provider", () => ({
  useT: () => (key: string, values?: { time?: string }) =>
    values?.time ? `${key} ${values.time}` : key,
}));
const { ImageJobFeedback, formatImageJobElapsed } = await import("./image-job-feedback");

const data: ImageNodeData = {
  jobId: "job-1",
  execution: { runId: "run", status: "failed", startedAt: 1000, finishedAt: 66000 },
  imageJob: {
    key: "key",
    index: 0,
    status: "failed",
    canRetryDownload: true,
    input: { providerId: "provider", modelKey: "model", prompt: "tree", images: [], count: 1 },
  },
};

beforeEach(() => {
  Object.values(actions).forEach((action) => action.mockReset().mockResolvedValue(undefined));
});

describe("image task recovery controls", () => {
  it("shows elapsed time without inventing a progress percentage", () => {
    render(<ImageJobFeedback nodeId="image-1" data={data} />);
    expect(screen.getByText("imageJob.elapsed 1:05")).toBeVisible();
    expect(screen.getByRole("list", { name: "imageJob.stages" })).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(formatImageJobElapsed(2000, 1000)).toBe("0:00");
  });

  it("routes query and download to distinct non-generation operations", async () => {
    render(<ImageJobFeedback nodeId="image-1" data={data} />);
    fireEvent.click(screen.getByRole("button", { name: "imageJob.query" }));
    await waitFor(() => expect(actions.queryImageJob).toHaveBeenCalledWith("image-1"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "imageJob.download" })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "imageJob.download" }));
    await waitFor(() => expect(actions.retryImageDownload).toHaveBeenCalledWith("image-1"));
    expect(actions.regenerateImageJob).not.toHaveBeenCalled();
  });

  it("requires an explicit charge confirmation before regenerating", async () => {
    render(<ImageJobFeedback nodeId="image-1" data={data} />);
    fireEvent.click(screen.getByRole("button", { name: "imageJob.regenerate" }));
    expect(screen.getByRole("dialog", { name: "imageJob.confirmTitle" })).toBeVisible();
    expect(screen.getByText("imageJob.confirmDescription")).toBeVisible();
    expect(actions.regenerateImageJob).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "imageJob.confirmGenerate" }));
    await waitFor(() => expect(actions.regenerateImageJob).toHaveBeenCalledWith("image-1"));
  });

  it("disables download when there is no recoverable upstream output", () => {
    render(
      <ImageJobFeedback
        nodeId="image-1"
        data={{ ...data, imageJob: { ...data.imageJob!, canRetryDownload: false } }}
      />,
    );
    expect(screen.getByRole("button", { name: "imageJob.download" })).toBeDisabled();
  });
});
