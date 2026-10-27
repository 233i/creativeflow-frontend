import { describe, expect, it } from "vitest";
import { persistableTab, restoreWorkspace, workspaceLocation } from "./location";

const id = "10000000-0000-4000-8000-000000000001";
describe("admin workspace locations", () => {
  it("reuses one workflow tab for editor, publication and run history, but separates template sources", () => {
    const edit = workspaceLocation(`/admin/workflows/${id}/edit?source=workflow`)!;
    expect(workspaceLocation(`/admin/workflows/${id}/publications`)?.key).toBe(edit.key);
    expect(workspaceLocation(`/admin/workflows/${id}/runs?inspectRun=r`)?.key).toBe(edit.key);
    expect(workspaceLocation(`/admin/workflows/${id}/edit?source=template`)?.key).not.toBe(
      edit.key,
    );
    expect(workspaceLocation("/admin?tab=workflows")?.key).toBe(
      workspaceLocation("/admin/workflows?kind=media")?.key,
    );
  });
  it.each([
    "https://outside.test/admin",
    "javascript:alert(1)",
    "/admin/workflows/bad/edit",
    `/admin/workflows/${id}/unknown`,
    `/admin/workflows/${id}/edit?source=anything`,
    "/admin/unknown",
    "/admin/workflows/a/b/c",
  ])("rejects unregistered or external locations: %s", (href) => {
    expect(workspaceLocation(href)).toBeNull();
  });
  it("persists only approved navigation and filter values, without credentials or run inputs", () => {
    const tab = workspaceLocation(
      `/admin/workflows/${id}/runs?source=workflow&inputs=private&token=secret&inspectRun=run&returnTo=secret&q=filter&size=50`,
    )!;
    const saved = persistableTab(tab);
    expect(saved.href).toContain("q=filter");
    expect(saved.href).toContain("size=50");
    for (const name of ["inputs", "token", "inspectRun", "returnTo"])
      expect(saved.href).not.toContain(name);
    expect(saved).not.toHaveProperty("dirty");
    expect(saved.title).toBe(tab.title);
  });
  it("restores valid unique pages and tolerates corrupt storage", () => {
    expect(restoreWorkspace("broken")).toEqual([]);
    expect(
      restoreWorkspace(
        JSON.stringify([
          null,
          { href: "/admin?tab=models" },
          { href: "/admin?tab=models" },
          { href: "https://outside.test/admin" },
        ]),
      ),
    ).toHaveLength(1);
  });
});
