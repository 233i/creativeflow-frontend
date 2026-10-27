import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { createApiClient } from "@/lib/api-client";

const request = createApiClient({
  baseUrl: "/api/v1/example",
  createError: (failure) =>
    Object.assign(new Error(failure.code ?? failure.fallbackMessage), failure),
});

let fetchMock: MockInstance<typeof fetch>;

beforeEach(() => {
  fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ok: true }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

function sentHeaders(): Headers {
  return new Headers(fetchMock.mock.calls[0][1]?.headers);
}

describe("API transport", () => {
  it.each([
    ["/api/v1/admin", "/workflow-center", 401, true],
    ["/api/v1", "/admin/ai/providers", 401, true],
    ["/api/v1", "/auth/me", 401, false],
    ["/api/v1/admin", "/workflow-center", 403, false],
  ])(
    "notifies the shared admin session only for an admin 401: %s%s %s",
    async (baseUrl, path, status, expected) => {
      fetchMock.mockResolvedValue(Response.json({ error: "unauthorized" }, { status }));
      const listener = vi.fn();
      window.addEventListener("creativeflow:admin-session-expired", listener);
      const adminRequest = createApiClient({ baseUrl, createError: () => new Error("denied") });
      try {
        await expect(adminRequest(path)).rejects.toThrow("denied");
        expect(listener).toHaveBeenCalledTimes(expected ? 1 : 0);
      } finally {
        window.removeEventListener("creativeflow:admin-session-expired", listener);
      }
    },
  );

  it("sends JSON with session cookies and preserves request options", async () => {
    const controller = new AbortController();
    const body = JSON.stringify({ name: "example" });

    await expect(
      request("/items", {
        method: "POST",
        credentials: "omit",
        body,
        signal: controller.signal,
        cache: "no-store",
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/example/items",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body,
        signal: controller.signal,
        cache: "no-store",
      }),
    );
    expect(sentHeaders().get("Accept")).toBe("application/json");
    expect(sentHeaders().get("Content-Type")).toBe("application/json");
  });

  it("does not add a content type to requests without a body", async () => {
    await request("/items");

    expect(sentHeaders().has("Content-Type")).toBe(false);
  });

  it.each<{ kind: string; headers: HeadersInit }>([
    {
      kind: "record",
      headers: {
        accept: "application/problem+json",
        "content-type": "text/plain",
        "x-request-id": "123",
      },
    },
    {
      kind: "Headers",
      headers: new Headers({
        accept: "application/problem+json",
        "content-type": "text/plain",
        "x-request-id": "123",
      }),
    },
    {
      kind: "tuples",
      headers: [
        ["accept", "application/problem+json"],
        ["content-type", "text/plain"],
        ["x-request-id", "123"],
      ],
    },
  ])("preserves caller headers provided as $kind", async ({ headers }) => {
    await request("/items", { method: "POST", body: "content", headers });

    expect(sentHeaders().get("Accept")).toBe("application/problem+json");
    expect(sentHeaders().get("Content-Type")).toBe("text/plain");
    expect(sentHeaders().get("X-Request-Id")).toBe("123");
    expect(new Headers(headers).get("Accept")).toBe("application/problem+json");
  });

  it("leaves multipart boundaries to the browser", async () => {
    const form = new FormData();
    form.append("file", new File(["skill"], "skill.zip", { type: "application/zip" }));

    await request("/upload", { method: "POST", body: form });

    expect(fetchMock.mock.calls[0][1]?.body).toBe(form);
    expect(sentHeaders().has("Content-Type")).toBe(false);
  });

  it("accepts 204 responses without trying to parse JSON", async () => {
    const response = new Response(null, { status: 204 });
    const json = vi.spyOn(response, "json");
    fetchMock.mockResolvedValue(response);

    await expect(request("/items/1", { method: "DELETE" })).resolves.toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });

  it("passes the server code, status and validation details to the domain error", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          error: "invalid_graph",
          details: ["Node is missing", "Output is disconnected"],
        },
        { status: 422 },
      ),
    );

    await expect(request("/items")).rejects.toMatchObject({
      message: "invalid_graph",
      code: "invalid_graph",
      status: 422,
      details: ["Node is missing", "Output is disconnected"],
    });
  });

  it.each([null, [], "bad gateway", { error: { message: "nested" }, details: "invalid details" }])(
    "handles an unexpected error body: %j",
    async (body) => {
      fetchMock.mockResolvedValue(Response.json(body, { status: 502 }));

      await expect(request("/items")).rejects.toMatchObject({
        message: "Request failed with status 502",
        status: 502,
        code: null,
        details: [],
      });
    },
  );

  it("filters non-string validation details before exposing them to the UI", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          error: "invalid_graph",
          details: [null, 123, { message: "nested" }, "Node is missing"],
        },
        { status: 400 },
      ),
    );

    await expect(request("/items")).rejects.toMatchObject({
      details: ["Node is missing"],
    });
  });

  it("falls back to the status when the proxy returns HTML", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));

    await expect(request("/items")).rejects.toMatchObject({
      message: "Request failed with status 502",
      status: 502,
    });
  });

  it("maps connection failures to the domain error with status zero", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(request("/items")).rejects.toMatchObject({
      message: "Failed to reach the API",
      status: 0,
      code: null,
      details: [],
    });
  });

  it("does not misclassify invalid successful JSON as a connection failure", async () => {
    fetchMock.mockResolvedValue(new Response("invalid json", { status: 200 }));

    await expect(request("/items")).rejects.toBeInstanceOf(SyntaxError);
  });
});
