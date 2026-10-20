import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiStore } from "@/features/ai/store";
import type { AiProvider, AiModel } from "@/features/ai/types";
import { useModelForm } from "./use-model-form";
import { INHERIT } from "./model-form-options";

vi.mock("@/components/providers/i18n-provider", () => ({ useT: () => (key: string) => key }));
const provider: AiProvider = {
  id: "provider",
  name: "Provider",
  type: "openai-chat",
  baseUrl: "https://example.test",
  enabled: true,
  hasApiKey: true,
  sortOrder: 0,
  createdAt: "",
  updatedAt: "",
  models: [],
};
const model: AiModel = {
  id: "legacy",
  modelKey: "legacy-key",
  name: "Legacy",
  enabled: true,
  category: "chat",
  type: "anthropic",
  contextLength: 128000,
  maxOutputTokens: 4096,
  supportsVision: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  useAiStore.setState(
    {
      ...useAiStore.getInitialState(),
      addModel: vi.fn(async () => {}),
      updateModel: vi.fn(async () => {}),
    },
    true,
  );
});
describe("model form compatibility", () => {
  it("restores a legacy override and sends an explicit clearing value when inheritance is chosen", async () => {
    const close = vi.fn();
    const hook = renderHook(() =>
      useModelForm({ isOpen: true, onOpenChange: close, provider, model }),
    );
    expect(hook.result.current.type).toBe("anthropic");
    expect(hook.result.current.contextLength).toBe("128000");
    expect(hook.result.current.supportsVision).toBe(true);
    expect(hook.result.current.supportsThinking).toBe(false);
    act(() => hook.result.current.setType(INHERIT));
    await act(async () => hook.result.current.save());
    expect(useAiStore.getState().updateModel).toHaveBeenCalledWith(
      "legacy",
      expect.objectContaining({ type: "", supportsVision: true, contextLength: 128000 }),
    );
    expect(close).toHaveBeenCalledWith(false);
  });
  it("keeps the edited form open and preserves values on a failed save", async () => {
    const close = vi.fn();
    vi.mocked(useAiStore.getState().updateModel).mockRejectedValueOnce(
      new Error("configuration rejected"),
    );
    const hook = renderHook(() =>
      useModelForm({ isOpen: true, onOpenChange: close, provider, model }),
    );
    act(() => hook.result.current.setName("New name"));
    await act(async () => hook.result.current.save());
    expect(hook.result.current.name).toBe("New name");
    expect(hook.result.current.error).toBe("configuration rejected");
    expect(hook.result.current.busy).toBe(false);
    expect(close).not.toHaveBeenCalled();
  });
  it("restricts protocol choices to the current model category", () => {
    const hook = renderHook(() =>
      useModelForm({ isOpen: true, onOpenChange: vi.fn(), provider, model: null }),
    );
    act(() => hook.result.current.setCategory("image"));
    expect(hook.result.current.allowedProtocols).toContain("openai-images");
    expect(hook.result.current.allowedProtocols).not.toContain("anthropic");
    expect(hook.result.current.inheritedProtocol).toBe("openai-images");
  });
});
