import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/features/ai/api";
import { useAiStore } from "@/features/ai/store";
import type { AiProvider } from "@/features/ai/types";
import { ProviderPanel } from "./provider-panel";

vi.mock("@/features/ai/api");
vi.mock("@/components/providers/i18n-provider", () => ({ useT: () => (key: string) => key }));

const provider: AiProvider = {
  id: "embedding-provider",
  name: "LM Studio",
  builtinId: "lm-studio-embedding",
  type: "openai-embeddings",
  baseUrl: "http://127.0.0.1:1234/v1",
  enabled: true,
  hasApiKey: false,
  sortOrder: 0,
  models: [],
  createdAt: "2026-09-12T00:00:00Z",
  updatedAt: "2026-09-12T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  useAiStore.setState({ ...useAiStore.getInitialState(), providers: [provider] }, true);
});

describe("ProviderPanel embedding setup", () => {
  it("refreshes the admin catalog after discovery without requesting user MCP servers", async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchUpstreamModels).mockResolvedValue({
      models: [{ modelKey: "qwen3-embedding-8b", name: "Qwen", category: "embedding", icon: null }],
    });
    vi.mocked(api.importModels).mockResolvedValue({ added: 1 });
    vi.mocked(api.listAdminProviders).mockResolvedValue({ providers: [provider] });
    vi.mocked(api.listAdminModelSlots).mockResolvedValue({ slots: [] });
    render(<ProviderPanel />);
    expect(screen.getByLabelText("provider.apiKey")).toBeInTheDocument();
    expect(screen.getByText("embedding.optionalKey")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "provider.fetchModels" }));
    await waitFor(() => expect(api.listAdminProviders).toHaveBeenCalledOnce());
    expect(api.listMcpServers).not.toHaveBeenCalled();
    expect(api.listProviders).not.toHaveBeenCalled();
    expect(api.importModels).toHaveBeenCalledWith(provider.id, [
      { modelKey: "qwen3-embedding-8b", name: "Qwen", category: "embedding", enabled: false },
    ]);
  });
});
