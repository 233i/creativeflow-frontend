import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiModel, AiProvider } from "@/features/ai/types";
import type { EmbeddingSettings } from "@/features/ai/embedding-api";

const api = vi.hoisted(() => ({
  getEmbeddingSettings: vi.fn(),
  saveEmbeddingSettings: vi.fn(),
  testEmbeddingModel: vi.fn(),
}));
vi.mock("@/features/ai/embedding-api", () => api);
vi.mock("@/components/providers/i18n-provider", () => ({ useT: () => (key: string) => key }));
const { EmbeddingModelDialog } = await import("./embedding-model-dialog");

const settings: EmbeddingSettings = {
  endpointPath: "embeddings",
  expectedDimensions: null,
  requestedDimensions: null,
  modelRevision: "",
  documentPrefix: "",
  queryPrefix: "",
  maxBatchSize: 16,
  maxInputCharacters: 12000,
  timeoutSeconds: 120,
  concurrency: 1,
};
const model = {
  id: "model-1",
  modelKey: "local-embedding",
  name: "Local embedding",
  enabled: true,
  type: "openai-embeddings",
  category: "embedding",
} as AiModel;
const provider = {
  id: "provider-1",
  name: "LM Studio",
  type: "openai-embeddings",
  baseUrl: "http://127.0.0.1:1234/v1",
  enabled: true,
  models: [model],
} as AiProvider;

beforeEach(() => {
  vi.clearAllMocks();
  api.getEmbeddingSettings.mockResolvedValue({ settings, version: "v1" });
  api.saveEmbeddingSettings.mockImplementation(async (_id: string, value: EmbeddingSettings) => ({
    settings: value,
    version: "v2",
  }));
  api.testEmbeddingModel.mockResolvedValue({
    ok: true,
    dimensions: 4096,
    count: 2,
    elapsedMilliseconds: 100,
    totalTokens: null,
    configurationVersion: "v1",
    configurationFingerprint: "sha256:test",
  });
});

describe("EmbeddingModelDialog", () => {
  it("loads settings without inference and explicitly tests only the saved model", async () => {
    const user = userEvent.setup();
    render(<EmbeddingModelDialog provider={provider} model={model} onClose={vi.fn()} />);
    const button = await screen.findByRole("button", { name: "embedding.test" });
    expect(api.testEmbeddingModel).not.toHaveBeenCalled();
    expect(screen.getByText("http://127.0.0.1:1234/v1/embeddings")).toBeInTheDocument();
    await user.click(button);
    expect(api.testEmbeddingModel).toHaveBeenCalledWith(
      "model-1",
      expect.any(Array),
      "document",
      expect.any(AbortSignal),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("embedding.success");
  });

  it("requires a saved version before testing", async () => {
    const user = userEvent.setup();
    api.getEmbeddingSettings.mockResolvedValue({ settings, version: null });
    render(<EmbeddingModelDialog provider={provider} model={model} onClose={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "embedding.test" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "common.save" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "embedding.test" })).toBeEnabled(),
    );
    expect(api.testEmbeddingModel).not.toHaveBeenCalled();
  });

  it("blocks testing edited fields until saving and preserves the chosen dimension", async () => {
    const user = userEvent.setup();
    render(<EmbeddingModelDialog provider={provider} model={model} onClose={vi.fn()} />);
    const field = await screen.findByRole("spinbutton", { name: "embedding.expectedDimensions" });
    await user.type(field, "4096");
    expect(screen.getByRole("button", { name: "embedding.test" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "common.save" }));
    expect(api.saveEmbeddingSettings).toHaveBeenCalledWith(
      "model-1",
      expect.objectContaining({ expectedDimensions: 4096 }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "embedding.test" })).toBeEnabled(),
    );
    expect(api.testEmbeddingModel).not.toHaveBeenCalled();
  });

  it("does not allow chat protocol to masquerade as an embeddings client", async () => {
    render(
      <EmbeddingModelDialog
        provider={provider}
        model={{ ...model, type: "openai-chat" }}
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByRole("button", { name: "embedding.test" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("embedding.protocolHint");
  });

  it("renders upstream failure without resubmitting", async () => {
    const user = userEvent.setup();
    api.testEmbeddingModel.mockResolvedValue({
      ok: false,
      code: "timeout_unknown",
      error: "No retry was made.",
      totalTokens: null,
    });
    render(<EmbeddingModelDialog provider={provider} model={model} onClose={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "embedding.test" }));
    expect(await screen.findByRole("status")).toHaveTextContent("timeout_unknown");
    expect(api.testEmbeddingModel).toHaveBeenCalledTimes(1);
  });
});
