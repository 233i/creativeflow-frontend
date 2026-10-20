import { beforeEach, describe, expect, it, vi } from "vitest";
import { getImageGenerationSettings, updateImageGenerationSettings } from "@/features/ai/api";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("administrator image generation settings API", () => {
  it("reads the application-wide response format with the admin session", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ responseFormat: "url", updatedAt: "2026-08-18T00:00:00Z" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getImageGenerationSettings()).resolves.toMatchObject({ responseFormat: "url" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/admin/ai/image-generation-settings",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("updates the response format with an authenticated PUT request", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ responseFormat: "base64", updatedAt: "2026-08-18T00:00:00Z" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    await updateImageGenerationSettings("base64");

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/admin/ai/image-generation-settings",
      expect.objectContaining({
        method: "PUT",
        credentials: "include",
        body: JSON.stringify({ responseFormat: "base64" }),
      }),
    );
  });
});
