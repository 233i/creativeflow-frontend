import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiStore } from "@/features/ai/store";
import type { AiProvider } from "@/features/ai/types";
import { useProviderDetail } from "./use-provider-detail";

vi.mock("@/components/providers/i18n-provider", () => ({ useT: () => (key: string) => key }));
const provider: AiProvider = {
  id: "provider",
  name: "Provider",
  type: "anthropic",
  baseUrl: "https://example.test",
  enabled: true,
  hasApiKey: true,
  sortOrder: 0,
  createdAt: "",
  updatedAt: "",
  models: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  useAiStore.setState(
    {
      ...useAiStore.getInitialState(),
      updateProvider: vi.fn(async () => {}),
      updateModel: vi.fn(async () => {}),
    },
    true,
  );
});
describe("provider save feedback", () => {
  it("contains a rejected key save, preserves its input and clears it only after a successful retry", async () => {
    vi.mocked(useAiStore.getState().updateProvider).mockRejectedValueOnce(
      new Error("provider rejected"),
    );
    const hook = renderHook(() => useProviderDetail(provider));
    act(() => hook.result.current.setApiKeyDraft("synthetic-key"));
    await act(async () => {
      await expect(hook.result.current.saveApiKey()).resolves.toBeUndefined();
    });
    expect(hook.result.current.apiKeyDraft).toBe("synthetic-key");
    expect(hook.result.current).toMatchObject({ error: "provider rejected", saving: false });
    await act(async () => hook.result.current.saveApiKey());
    expect(hook.result.current.apiKeyDraft).toBe("");
  });
  it("keeps a failed base URL draft and normalizes it when saving succeeds", async () => {
    vi.mocked(useAiStore.getState().updateProvider).mockRejectedValueOnce(
      new Error("invalid endpoint"),
    );
    const hook = renderHook(() => useProviderDetail(provider));
    act(() => hook.result.current.setBaseUrl("https://new.example.test/v1/messages"));
    await act(async () => {
      await expect(hook.result.current.saveBaseUrl()).resolves.toBeUndefined();
    });
    expect(hook.result.current.baseUrl).toBe("https://new.example.test/v1/messages");
    expect(hook.result.current).toMatchObject({ error: "invalid endpoint" });
    await act(async () => hook.result.current.saveBaseUrl());
    expect(hook.result.current.baseUrl).toBe("https://new.example.test");
  });
  it("surfaces an enable-model failure without an unhandled rejection", async () => {
    vi.mocked(useAiStore.getState().updateModel).mockRejectedValueOnce(
      new Error("model permission denied"),
    );
    const hook = renderHook(() => useProviderDetail(provider));
    await act(async () => {
      await expect(
        hook.result.current.updateModel("model", { enabled: true }),
      ).resolves.toBeDefined();
    });
    expect(hook.result.current).toMatchObject({ error: "model permission denied" });
  });
});
