import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const adminState = vi.hoisted(() => ({
  providers: [
    {
      id: "provider-1",
      name: "Primary provider",
      enabled: true,
      models: [
        {
          id: "model-1",
          modelKey: "image-model",
          name: "Image model",
          enabled: false,
          category: "image",
        },
      ],
    },
  ],
  updateModel: vi.fn(),
}));

vi.mock("@/components/providers/i18n-provider", () => ({
  useT: () => (key: string) =>
    ({
      "common.search": "搜索",
      "common.enabled": "已启用",
      "common.disabled": "已禁用",
      "model.title": "模型管理",
      "model.empty": "暂无模型",
      "model.categoryImage": "图片",
      "provider.emptyDescription": "暂无配置",
    })[key] ?? key,
}));

vi.mock("@/features/ai/provider-icons", () => ({
  ModelIcon: () => <span aria-hidden />,
  ProviderIcon: () => <span aria-hidden />,
}));

vi.mock("@/features/ai/store", () => ({
  useAiStore: (selector: (state: typeof adminState) => unknown) => selector(adminState),
}));

const { ModelPanel } = await import("@/features/settings/panels/model-panel");

beforeEach(() => {
  vi.clearAllMocks();
  adminState.updateModel.mockResolvedValue(undefined);
});

describe("ModelPanel", () => {
  it("lets an administrator enable a disabled provider/model pair", async () => {
    const user = userEvent.setup();
    render(<ModelPanel />);

    expect(screen.getByText("已禁用")).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Image model · Primary provider" }));

    await waitFor(() => {
      expect(adminState.updateModel).toHaveBeenCalledWith("model-1", { enabled: true });
    });
  });
});
