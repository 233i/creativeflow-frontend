import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  instantiateWorkflowTemplate,
  listWorkflowTemplates,
} from "@/features/workflow/templates-api";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("workflow template API", () => {
  it("passes search and category filters with the device session", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ templates: [] }));

    await listWorkflowTemplates("海报", "电商");

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/workflow-templates?search=%E6%B5%B7%E6%8A%A5&category=%E7%94%B5%E5%95%86",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("instantiates an independent workflow with the requested name", async () => {
    const created = {
      id: "workflow-id",
      name: "我的商品海报",
      schemaVersion: 1,
      graph: { nodes: [], edges: [] },
      createdAt: "2026-08-20T00:00:00Z",
      updatedAt: "2026-08-20T00:00:00Z",
    };
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(created));

    await expect(instantiateWorkflowTemplate("template/id", " 我的商品海报 ")).resolves.toEqual(
      created,
    );

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/workflow-templates/template%2Fid/instantiate",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ name: "我的商品海报" }),
      }),
    );
  });
});
