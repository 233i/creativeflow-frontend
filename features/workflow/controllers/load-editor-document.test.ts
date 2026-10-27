import { beforeEach, describe, expect, it, vi } from "vitest";
import * as admin from "@/features/admin/api";
import { loadEditorDocument } from "./load-editor-document";
import { controllerFixture, deferred } from "./controller-test-helpers";
import { WorkflowApiError } from "../api";
import type { WorkflowTemplateDocument } from "../templates-api";

vi.mock("@/features/admin/api", () => ({
  getMe: vi.fn(),
  getWorkflowTemplate: vi.fn(),
  prepareWorkflowTemplateDebug: vi.fn(),
}));
vi.mock("@/lib/device", () => ({ handshake: vi.fn(), storedDeviceId: () => "device" }));
beforeEach(() => vi.resetAllMocks());
function environment() {
  return {
    current: () => true,
    loadAi: vi.fn().mockResolvedValue(undefined),
    refreshAdminAi: vi.fn().mockResolvedValue(undefined),
  };
}

describe("editor source loading", () => {
  it("reuses the workspace session while still reading the authorized admin document endpoint", async () => {
    const { document, client } = controllerFixture();
    const env = { ...environment(), adminVerified: true };
    expect(await loadEditorDocument({ kind: "api", id: document.id }, client, env)).toMatchObject({
      document,
    });
    expect(admin.getMe).not.toHaveBeenCalled();
    expect(env.refreshAdminAi).not.toHaveBeenCalled();
    expect(client.getWorkflow).toHaveBeenCalledWith(document.id);
  });
  it("redirects a non-admin without reading or preparing a document", async () => {
    const { client } = controllerFixture();
    vi.mocked(admin.getMe).mockResolvedValue({ admin: null, isAuthenticated: false });
    expect(await loadEditorDocument({ kind: "template", id: "w" }, client, environment())).toEqual({
      redirect: "/admin?tab=workflowTemplates",
    });
    expect(admin.getWorkflowTemplate).not.toHaveBeenCalled();
    expect(admin.prepareWorkflowTemplateDebug).not.toHaveBeenCalled();
  });
  it("does not prepare a debug workflow when an editor closed during template loading", async () => {
    const { document, client } = controllerFixture();
    const pending = deferred<WorkflowTemplateDocument>();
    let alive = true;
    vi.mocked(admin.getMe).mockResolvedValue({
      admin: { id: "a", username: "a", mustChangePassword: false },
      isAuthenticated: true,
    });
    vi.mocked(admin.getWorkflowTemplate).mockReturnValue(pending.promise);
    const loading = loadEditorDocument({ kind: "template", id: "w" }, client, {
      ...environment(),
      current: () => alive,
    });
    await vi.waitFor(() => expect(admin.getWorkflowTemplate).toHaveBeenCalled());
    alive = false;
    pending.resolve({ ...document, status: "draft" } as WorkflowTemplateDocument);
    expect(await loading).toBeNull();
    expect(admin.prepareWorkflowTemplateDebug).not.toHaveBeenCalled();
  });
  it("isolates denied typed history while preserving the editable document", async () => {
    const { document, client } = controllerFixture();
    client.getLatestWorkflowRun.mockRejectedValue(new WorkflowApiError("denied", 403));
    expect(
      await loadEditorDocument({ kind: "workflow", id: document.id }, client, environment()),
    ).toMatchObject({
      document,
      run: null,
      accessError: expect.stringContaining("访问权限已失效"),
    });
  });
  it("continues structural editing when admin model settings are unavailable", async () => {
    const { document, client } = controllerFixture();
    vi.mocked(admin.getMe).mockResolvedValue({
      admin: { id: "a", username: "a", mustChangePassword: false },
      isAuthenticated: true,
    });
    const env = environment();
    env.refreshAdminAi.mockRejectedValue(new Error("settings unavailable"));
    expect(await loadEditorDocument({ kind: "api", id: document.id }, client, env)).toMatchObject({
      document,
    });
  });
});
