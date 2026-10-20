import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthApiError, loginWithPassword, registerWithPassword } from "@/features/auth/api";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("password auth API", () => {
  it("registers with JSON credentials and keeps cookies enabled", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ isGuest: false, account: { id: "a", displayName: "Alice" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    await registerWithPassword("alice@example.com", "a long password", "Alice");

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/auth/password/register",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          email: "alice@example.com",
          password: "a long password",
          displayName: "Alice",
        }),
      }),
    );
  });

  it("preserves the server error code for the form", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "invalid_credentials",
          details: ["email or password is incorrect"],
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );

    const error = await loginWithPassword("alice@example.com", "wrong password").catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(AuthApiError);
    expect(error).toMatchObject({ status: 401, code: "invalid_credentials" });
  });
});
