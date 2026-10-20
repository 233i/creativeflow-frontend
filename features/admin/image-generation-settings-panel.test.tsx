import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getImageGenerationSettings: vi.fn(),
  updateImageGenerationSettings: vi.fn(),
}));

vi.mock("@/features/ai/api", () => ({
  AiApiError: class AiApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
      readonly details: string[] = [],
    ) {
      super(message);
    }
  },
  getImageGenerationSettings: mocks.getImageGenerationSettings,
  updateImageGenerationSettings: mocks.updateImageGenerationSettings,
}));

const { ImageGenerationSettingsPanel } =
  await import("@/features/admin/image-generation-settings-panel");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getImageGenerationSettings.mockResolvedValue({
    responseFormat: "url",
    updatedAt: "2026-08-18T00:00:00Z",
  });
  mocks.updateImageGenerationSettings.mockResolvedValue({
    responseFormat: "base64",
    updatedAt: "2026-08-18T00:01:00Z",
  });
});

describe("ImageGenerationSettingsPanel", () => {
  it("loads the server policy and lets an administrator switch it to Base64", async () => {
    const user = userEvent.setup();
    render(<ImageGenerationSettingsPanel />);

    expect(await screen.findByText("URL 模式")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Base64" }));
    expect(screen.getByText("Base64 模式")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "保存设置" }));

    await waitFor(() => {
      expect(mocks.updateImageGenerationSettings).toHaveBeenCalledWith("base64");
    });
    expect(
      screen.getByText("图片返回类型已更新，后续生成任务将立即使用新设置。"),
    ).toBeInTheDocument();
  });
});
