import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadAsset, type UploadedAsset } from "@/features/ai/api";
import { useAgentAttachments } from "./use-agent-attachments";

vi.mock("@/features/ai/api", () => ({ uploadAsset: vi.fn() }));
vi.mock("@/components/providers/i18n-provider", () => ({ useT: () => (key: string) => key }));
const files = Array.from(
  { length: 8 },
  (_, index) => new File(["x"], index + ".png", { type: "image/png" }),
) as unknown as FileList;
beforeEach(() => vi.clearAllMocks());
describe("attachment upload ownership", () => {
  it("accepts only one batch when two inputs arrive before the busy render", async () => {
    let finish!: (value: UploadedAsset) => void;
    vi.mocked(uploadAsset)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      )
      .mockImplementation(async (file) => ({
        assetId: file.name,
        url: "/asset",
        mediaType: "image/png",
      }));
    const hook = renderHook(() => useAgentAttachments(true));
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.acceptImages(files);
      void hook.result.current.acceptImages(files);
    });
    expect(uploadAsset).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish({ assetId: "first", url: "/asset", mediaType: "image/png" });
      await pending;
    });
    expect(hook.result.current.attachments).toHaveLength(8);
  });
  it("aborts the active upload and does not start remaining files after the panel unmounts", async () => {
    let finish!: (value: UploadedAsset) => void;
    vi.mocked(uploadAsset)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      )
      .mockResolvedValue({ assetId: "late", url: "/asset", mediaType: "image/png" });
    const hook = renderHook(() => useAgentAttachments(true));
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.acceptImages(files);
    });
    const signal = vi.mocked(uploadAsset).mock.calls[0][1];
    hook.unmount();
    await act(async () => {
      finish({ assetId: "late", url: "/asset", mediaType: "image/png" });
      await pending;
    });
    expect(uploadAsset).toHaveBeenCalledTimes(1);
    expect(signal?.aborted).toBe(true);
  });
});
