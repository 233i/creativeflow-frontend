import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  changePassword,
  prepareWorkflowTemplateDebug,
  publishWorkflowTemplate,
  saveWorkflowTemplateGraph,
} from "@/features/admin/api";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("admin workflow template API", () => {
  it("publishes a template through the authenticated admin endpoint", async () => {
    const template = { id: "template-id", status: "published" };
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(template));

    await expect(publishWorkflowTemplate("template/id")).resolves.toEqual(template);

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/admin/workflow-templates/template%2Fid/publish",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("saves a draft graph without replacing template metadata", async () => {
    const graph = { nodes: [], edges: [] };
    const template = { id: "template-id", graph };
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(template));

    await expect(saveWorkflowTemplateGraph("template/id", graph)).resolves.toEqual(template);

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/admin/workflow-templates/template%2Fid",
      expect.objectContaining({
        method: "PUT",
        credentials: "include",
        body: JSON.stringify({ schemaVersion: 1, graph }),
      }),
    );
  });

  it("prepares the hidden workflow used by template debugging", async () => {
    const workflow = { id: "debug-workflow-id" };
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(workflow));

    await expect(prepareWorkflowTemplateDebug("template/id")).resolves.toEqual(workflow);

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/admin/workflow-templates/template%2Fid/debug-workflow",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });
});

describe("admin password API", () => {
  it("sends the current and new password with an authenticated PATCH request", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await changePassword("current-password", "new-secure-password");

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/admin/auth/password",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        body: JSON.stringify({
          currentPassword: "current-password",
          newPassword: "new-secure-password",
        }),
      }),
    );
  });
});
