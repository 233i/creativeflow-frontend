import { describe, expect, it, vi } from "vitest";
import { verifyBrowserEnvironment } from "./browser-environment.mjs";

const options = {
  baseURL: "http://127.0.0.1:55444",
  apiOrigin: "http://127.0.0.1:55443",
  environment: "MigrationBaseline",
};
const info = (environment = options.environment, service = "creativeflow-api") =>
  Response.json({ service, environment });

describe("cross-service browser preflight", () => {
  it("checks both the direct API and the actual frontend proxy", async () => {
    const fetcher = vi.fn().mockImplementation(async () => info());
    await verifyBrowserEnvironment({ ...options, fetcher });
    expect(fetcher.mock.calls.map(([url]) => url.href)).toEqual([
      "http://127.0.0.1:55443/api/v1/system/info",
      "http://127.0.0.1:55444/api/v1/system/info",
    ]);
  });

  it("rejects a build whose rewrite still targets production", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(info()).mockResolvedValueOnce(info("Production"));
    await expect(verifyBrowserEnvironment({ ...options, fetcher })).rejects.toThrow("Web proxy");
  });

  it("does not allow opting production into account-creating tests", async () => {
    const fetcher = vi.fn();
    await expect(
      verifyBrowserEnvironment({ ...options, environment: "Production", fetcher }),
    ).rejects.toThrow("require");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    info("Development"),
    info(options.environment, "another-api"),
    new Response("", { status: 503 }),
  ])("fails before browser operations on a wrong or unavailable backend", async (response) => {
    const fetcher = vi.fn().mockResolvedValue(response);
    await expect(verifyBrowserEnvironment({ ...options, fetcher })).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(["https://name:secret@example.invalid", "http://localhost:3000/path", "file:///tmp/api"])(
    "rejects ambiguous origins without echoing their contents",
    async (apiOrigin) => {
      const fetcher = vi.fn();
      await expect(verifyBrowserEnvironment({ ...options, apiOrigin, fetcher })).rejects.toThrow(
        "HTTP origin",
      );
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
});
