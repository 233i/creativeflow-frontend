import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/features/ai/api";
import { useAiStore } from "@/features/ai/store";
import type { AiProvider } from "@/features/ai/types";
import { ModelConfigPanel } from "./model-config-panel";

vi.mock("@/features/ai/api");
vi.mock("@/components/providers/i18n-provider", () => ({
  useT: () => (key: string, values?: Record<string, string | number>) =>
    key === "modelConfig.enabledHint" ? `enabled ${values?.count ?? 0}` : key,
}));
vi.mock("@/features/ai/provider-icons", () => ({
  ModelIcon: () => <span aria-hidden />,
  ProviderIcon: () => <span aria-hidden />,
}));

const provider: AiProvider = {
  id: "provider-1",
  name: "Primary provider",
  type: "openai-images",
  baseUrl: "https://images.example/v1",
  enabled: true,
  hasApiKey: true,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  models: [
    {
      id: "image-1",
      modelKey: "image-one",
      name: "Image one",
      enabled: true,
      category: "image",
    },
    {
      id: "image-2",
      modelKey: "image-two",
      name: "Image two",
      enabled: true,
      category: "image",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.updateModel).mockResolvedValue(provider.models[0]);
  vi.mocked(api.listAdminProviders).mockResolvedValue({ providers: [provider] });
  vi.mocked(api.listAdminModelSlots).mockResolvedValue({ slots: [] });
  useAiStore.setState({
    providers: [provider],
    slots: {
      chat: { providerId: null, modelId: null },
      fast: { providerId: null, modelId: null },
      image: { providerId: null, modelId: null },
      video: { providerId: null, modelId: null },
    },
  });
});

describe("ModelConfigPanel", () => {
  it("shows all enabled models as independent switches", () => {
    render(<ModelConfigPanel />);

    expect(screen.getByRole("switch", { name: "Image one · Primary provider" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Image two · Primary provider" })).toBeChecked();
    expect(screen.getByText("enabled 2")).toBeInTheDocument();
  });

  it("persists changing one enabled model without clearing the other", async () => {
    const user = userEvent.setup();
    render(<ModelConfigPanel />);

    await user.click(screen.getByRole("switch", { name: "Image one · Primary provider" }));

    await waitFor(() =>
      expect(api.updateModel).toHaveBeenCalledWith("image-1", { enabled: false }),
    );
    expect(api.updateModel).not.toHaveBeenCalledWith("image-2", expect.anything());
  });
});
