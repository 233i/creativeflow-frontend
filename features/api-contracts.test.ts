import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminApiError, getMe as getAdmin } from "@/features/admin/api";
import { AgentApiError, findSession, listTools } from "@/features/agent/api";
import { AiApiError, listProviders, uploadAsset } from "@/features/ai/api";
import { AuthApiError, getMe } from "@/features/auth/api";
import { CanvasApiError, listCanvases } from "@/features/canvas/api";
import { SkillApiError, listSkills, scanSkill } from "@/features/skills/api";
import { WorkflowApiError, getLatestWorkflowRun, listWorkflows } from "@/features/workflow/api";
import { listDeployments } from "@/features/workflow/external-api/api";
import { WorkflowTemplateApiError, listWorkflowTemplates } from "@/features/workflow/templates-api";

afterEach(() => {
  vi.restoreAllMocks();
});

// 同一份服务器错误在不同业务中有不同的呈现约定，公共传输层不能抹平这些差异。
const clients = [
  {
    name: "admin",
    request: getAdmin,
    errorType: AdminApiError,
    message: "validation_failed",
    networkMessage: "Failed to reach the API",
    fallback: "Request failed with status 502",
  },
  {
    name: "agent",
    request: listTools,
    errorType: AgentApiError,
    message: "Missing input",
    networkMessage: "Failed to reach the API",
    fallback: "Request failed with status 502",
  },
  {
    name: "ai",
    request: listProviders,
    errorType: AiApiError,
    message: "validation_failed",
    networkMessage: "Failed to reach the API",
    fallback: "Request failed with status 502",
  },
  {
    name: "auth",
    request: getMe,
    errorType: AuthApiError,
    message: "Missing input",
    networkMessage: "Failed to reach the authentication API",
    fallback: "Authentication request failed: 502",
  },
  {
    name: "canvas",
    request: listCanvases,
    errorType: CanvasApiError,
    message: "Missing input",
    networkMessage: "Failed to reach the API",
    fallback: "Request failed with status 502",
  },
  {
    name: "skills",
    request: listSkills,
    errorType: SkillApiError,
    message: "Missing input",
    networkMessage: "Failed to reach the API",
    fallback: "Request failed with status 502",
  },
  {
    name: "workflow",
    request: listWorkflows,
    errorType: WorkflowApiError,
    message: "Missing input",
    networkMessage: "Failed to reach the workflow API",
    fallback: "Request failed with status 502",
  },
  {
    name: "templates",
    request: listWorkflowTemplates,
    errorType: WorkflowTemplateApiError,
    message: "Missing input",
    networkMessage: "Failed to reach the workflow template API",
    fallback: "Request failed with status 502",
  },
  {
    name: "publication",
    request: () => listDeployments("workflow-1"),
    errorType: Error,
    message: "Missing input",
    networkMessage: "无法连接工作流 API",
    fallback: "请求失败（502）",
  },
];

describe.each(clients)(
  "$name API error contract",
  ({ request, errorType, message, networkMessage, fallback }) => {
    it("retains the domain error class and message priority", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        Response.json(
          {
            error: "validation_failed",
            details: ["Missing input", "Missing output"],
          },
          { status: 400 },
        ),
      );

      const error = await request().catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(errorType);
      expect(error).toMatchObject({ message, status: 400 });
      if (error instanceof AuthApiError) {
        expect(error.code).toBe("validation_failed");
      } else if (error instanceof Error && "details" in error) {
        expect(error.details).toEqual(["Missing input", "Missing output"]);
      }
    });

    it("retains its connection failure message", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

      const error = await request().catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(errorType);
      expect(error).toMatchObject({ message: networkMessage, status: 0 });
    });

    it("retains its fallback message for non-JSON proxy failures", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Bad gateway", { status: 502 }));

      await expect(request()).rejects.toMatchObject({ message: fallback, status: 502 });
    });
  },
);

describe("API integration boundaries", () => {
  it("keeps absent sessions and workflow runs nullable while propagating other failures", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    await expect(findSession("canvas-1")).resolves.toBeNull();
    await expect(getLatestWorkflowRun("workflow-1")).resolves.toBeNull();
    await expect(findSession("canvas-1")).rejects.toMatchObject({ isUnauthorized: true });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("uploads skill archives as multipart with the original file and session cookies", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ slug: "demo" }));
    const file = new File(["skill"], "skill.zip", { type: "application/zip" });

    await scanSkill(file);

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/skills/scan",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
    const init = fetch.mock.calls[0][1];
    expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
    expect((init?.body as FormData).get("file")).toBe(file);
  });

  it("keeps asset-upload cancellation distinguishable from API failures", async () => {
    const controller = new AbortController();
    const abort = new DOMException("Cancelled", "AbortError");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(abort);
    controller.abort();

    await expect(uploadAsset(new File(["image"], "image.png"), controller.signal)).rejects.toBe(
      abort,
    );
  });
});
