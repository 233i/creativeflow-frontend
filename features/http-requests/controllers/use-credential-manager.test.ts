import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { credentialApi, type HttpCredentialDetail } from "../credentials-api";
import { useCredentialManager } from "./use-credential-manager";

vi.mock("../credentials-api", () => ({
  credentialApi: { list: vi.fn(), detail: vi.fn(), save: vi.fn(), state: vi.fn() },
}));
const detail: HttpCredentialDetail = {
  id: "credential",
  name: "Scope",
  description: "Synthetic",
  enabled: true,
  currentRevision: "r1",
  revisions: [
    {
      id: "r1",
      createdAt: "2026-09-01T00:00:00Z",
      hasSecret: true,
      definition: {
        origin: "https://example.test",
        headers: ["Authorization"],
        requests: [{ method: "GET", url: "https://example.test/items" }],
      },
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(credentialApi.list).mockResolvedValue([detail]);
  vi.mocked(credentialApi.detail).mockResolvedValue(detail);
});
describe("credential form controller", () => {
  it("loads only secret metadata, retains failed input, then clears secret values after success", async () => {
    const onSaved = vi.fn();
    const hook = renderHook(() =>
      useCredentialManager({ onClose: vi.fn(), initialId: "credential", onSaved }),
    );
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.form.headers).toEqual([{ name: "Authorization", value: "" }]);
    act(() =>
      hook.result.current.setForm((value) => ({
        ...value,
        headers: [{ name: "Authorization", value: "synthetic-replacement" }],
      })),
    );
    vi.mocked(credentialApi.save).mockRejectedValueOnce(new Error("revision conflict"));
    await act(async () => hook.result.current.save());
    expect(hook.result.current.form.headers[0].value).toBe("synthetic-replacement");
    expect(hook.result.current.error).toBe("revision conflict");
    expect(onSaved).not.toHaveBeenCalled();
    vi.mocked(credentialApi.save).mockResolvedValue({ id: "credential", revisionId: "r2" });
    await act(async () => hook.result.current.save());
    expect(hook.result.current.form.headers[0].value).toBe("");
    expect(onSaved).toHaveBeenCalledWith("credential", "r2");
  });
  it("does not start a second save before React has rendered the busy flag", async () => {
    let finish!: (value: { id: string; revisionId: string }) => void;
    vi.mocked(credentialApi.save).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const hook = renderHook(() => useCredentialManager({ onClose: vi.fn() }));
    await act(async () => {});
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.save();
      void hook.result.current.save();
    });
    expect(credentialApi.save).toHaveBeenCalledOnce();
    await act(async () => {
      finish({ id: "credential", revisionId: "r1" });
      await pending;
    });
  });
  it("ignores a late detail after switching to another credential", async () => {
    let old!: (value: HttpCredentialDetail) => void;
    vi.mocked(credentialApi.detail).mockReturnValueOnce(
      new Promise((resolve) => {
        old = resolve;
      }),
    );
    const hook = renderHook(() => useCredentialManager({ onClose: vi.fn(), initialId: "old" }));
    act(() => hook.result.current.setId("new"));
    await waitFor(() => expect(hook.result.current.detail?.id).toBe("credential"));
    await act(async () => old({ ...detail, id: "old", name: "Stale" }));
    expect(hook.result.current.form.name).toBe("Scope");
  });
});
