import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadAsset } from "@/features/ai/api";
import { useAiStore } from "@/features/ai/store";
import type { AiProvider } from "@/features/ai/types";
import { useAgentStore } from "../store";
import { useAgentAttachments } from "./use-agent-attachments";
import { useAgentPanel } from "./use-agent-panel";

vi.mock("@/features/ai/api", () => ({ uploadAsset: vi.fn() }));
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
  models: [
    {
      id: "vision",
      modelKey: "vision",
      name: "Vision",
      enabled: true,
      category: "chat",
      supportsVision: true,
    },
    {
      id: "text",
      modelKey: "text",
      name: "Text",
      enabled: true,
      category: "chat",
      supportsVision: false,
    },
    { id: "image", modelKey: "image", name: "Image", enabled: true, category: "image" },
  ],
};
const image = {
  id: "attachment",
  url: "/synthetic.png",
  mediaType: "image/png",
  name: "synthetic.png",
};
beforeEach(() => {
  vi.clearAllMocks();
  useAiStore.setState({ ...useAiStore.getInitialState(), providers: [provider] }, true);
  useAgentStore.setState(
    { ...useAgentStore.getInitialState(), sendPrompt: vi.fn(async () => {}) },
    true,
  );
});
describe("Agent input controllers", () => {
  it("retains successful attachments on a later upload failure and removes only the chosen image", async () => {
    vi.mocked(uploadAsset)
      .mockResolvedValueOnce({ assetId: "first", url: "/first", mediaType: "image/png" })
      .mockRejectedValueOnce(new Error("quota"));
    const hook = renderHook(() => useAgentAttachments(true));
    const files = [
      new File(["x"], "first.png", { type: "image/png" }),
      new File(["x"], "second.png", { type: "image/png" }),
    ];
    await act(async () => hook.result.current.acceptImages(files as unknown as FileList));
    expect(hook.result.current.attachments.map((item) => item.id)).toEqual(["first"]);
    expect(hook.result.current.attachmentError).toBe("quota");
    act(() => hook.result.current.removeAttachment("first"));
    expect(hook.result.current.attachments).toEqual([]);
    expect(hook.result.current.attachmentError).toBeNull();
  });
  it("filters models by protocol and blocks image submission after switching to a text-only model", () => {
    const hook = renderHook(() => useAgentPanel());
    expect(hook.result.current.models.map((model) => model.value)).toEqual(["vision", "text"]);
    act(() => {
      hook.result.current.setPrompt("describe");
      hook.result.current.setAttachments([image]);
      hook.result.current.setSelectedModel("text");
    });
    expect(hook.result.current.canSend).toBe(false);
    act(() => hook.result.current.submit());
    expect(useAgentStore.getState().sendPrompt).not.toHaveBeenCalled();
    act(() => hook.result.current.setSelectedModel("vision"));
    act(() => hook.result.current.submit());
    expect(useAgentStore.getState().sendPrompt).toHaveBeenCalledWith({
      providerId: "provider",
      modelKey: "vision",
      prompt: "describe",
      images: [image],
    });
    expect(hook.result.current.prompt).toBe("");
    expect(hook.result.current.attachments).toEqual([]);
  });
  it("falls back to an available model when the selected model is disabled", () => {
    const hook = renderHook(() => useAgentPanel());
    act(() => hook.result.current.setSelectedModel("text"));
    act(() =>
      useAiStore.setState({
        providers: [
          {
            ...provider,
            models: provider.models.map((model) => ({ ...model, enabled: model.id !== "text" })),
          },
        ],
      }),
    );
    expect(hook.result.current.selected?.value).toBe("vision");
  });
});
