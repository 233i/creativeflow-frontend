import { afterEach, describe, expect, it, vi } from "vitest";
import {
  copyTemplateGraphForApi,
  createWorkflowApiAssets,
  editorApi,
  workflowApiAssetUrl,
} from "./workflow-api";
import * as regular from "@/features/workflow/api";
import * as publication from "@/features/workflow/external-api/api";
import type { WorkflowGraph } from "@/features/workflow/types";

afterEach(() => vi.unstubAllGlobals());

describe("admin workflow API boundary", () => {
  it("sends editing, debugging and publication to admin routes while preserving ordinary routes", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetch);
    await regular.getWorkflow("personal");
    await editorApi.getWorkflow("api-id");
    await editorApi.startWorkflowRun("api-id");
    await editorApi.resumeWorkflowRun("api-id", "run-id");
    await publication.publishWorkflow("api-id", "description", 2);
    await publication.listApiKeys("api-id");
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/workflows/personal",
      "/api/v1/admin/workflow-apis/api-id",
      "/api/v1/admin/workflow-apis/api-id/runs",
      "/api/v1/admin/workflow-apis/api-id/runs/run-id/resume",
      "/api/v1/admin/workflow-apis/api-id/publish",
      "/api/v1/admin/workflow-apis/api-id/api-keys",
    ]);
    for (const [, init] of fetch.mock.calls) expect(init.credentials).toBe("include");
  });

  it("uploads assets into the selected API and converts only local asset preview URLs", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetch);
    const file = new File(["test"], "image.png", { type: "image/png" });
    await createWorkflowApiAssets("api-id").uploadAsset(file);
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/admin/workflow-apis/api-id/assets");
    expect(fetch.mock.calls[0][1].body.get("file")).toBe(file);
    const id = "019d018e-377b-76e5-ae15-67c188052314";
    expect(workflowApiAssetUrl("api-id", `/api/v1/canvas/assets/${id}`)).toBe(
      `/api/v1/admin/workflow-apis/api-id/assets/${id}`,
    );
    expect(workflowApiAssetUrl("api-id", "https://example.test/image.png")).toBe(
      "https://example.test/image.png",
    );
  });

  it("copies template structure and contracts without retaining references to private debug assets", () => {
    const graph: WorkflowGraph = {
      nodes: [
        {
          id: "image",
          type: "image",
          position: { x: 0, y: 0 },
          data: { assetUrl: "/private.png", mediaType: "image/png" },
        },
      ],
      edges: [],
      externalApi: {
        schemaVersion: 1,
        inputs: [
          {
            key: "reference",
            label: "Reference",
            description: "",
            type: "image",
            required: true,
            target: { nodeId: "image", field: "assetUrl" },
            default: { assetId: "private" },
          },
        ],
        outputs: [],
      },
    };
    const copy = copyTemplateGraphForApi(graph);
    expect(copy.nodes[0].data.assetUrl).toBeUndefined();
    expect(copy.externalApi?.inputs[0].default).toBeUndefined();
    expect(copy.externalApi?.inputs[0].target).toEqual(graph.externalApi?.inputs[0].target);
    expect(graph.nodes[0].data.assetUrl).toBe("/private.png");
  });
});
