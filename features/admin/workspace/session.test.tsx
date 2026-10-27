import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import { useAdminSession } from "./session";

vi.mock("@/features/ai/store", () => ({
  useAiStore: (selector: (state: unknown) => unknown) => selector({ refreshAdmin: async () => {} }),
}));

afterEach(() => vi.restoreAllMocks());

describe("workspace administrator session", () => {
  it("ignores an old successful identity response after revocation", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof api.getMe>>) => void;
    vi.spyOn(api, "getMe").mockReturnValue(
      new Promise((yes) => {
        resolve = yes;
      }),
    );
    const { result } = renderHook(() => useAdminSession());
    act(() => window.dispatchEvent(new Event("creativeflow:admin-session-expired")));
    expect(result.current.identity).toBeNull();
    expect(result.current.checking).toBe(false);
    await act(async () =>
      resolve({
        isAuthenticated: true,
        admin: { id: "old", username: "old", mustChangePassword: false },
      }),
    );
    expect(result.current.identity).toBeNull();
  });
  it("retains the current identity during a transient network failure", async () => {
    const admin = { id: "admin", username: "admin", mustChangePassword: false };
    const get = vi.spyOn(api, "getMe").mockResolvedValue({ isAuthenticated: true, admin });
    const { result } = renderHook(() => useAdminSession());
    await waitFor(() => expect(result.current.identity).toEqual(admin));
    get.mockRejectedValue(new Error("offline"));
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current.identity).toEqual(admin);
  });
});
