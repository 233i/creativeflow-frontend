import { describe, expect, it, vi } from "vitest";
import { createWorkspaceStore, MAX_WORKSPACE_TABS, workspaceGuards } from "./store";

const url = (n: number, section = "edit") =>
  `/admin/workflows/10000000-0000-4000-8000-${String(n).padStart(12, "0")}/${section}`;
describe("workspace page ownership", () => {
  it("mounts the pinned center immediately when closing a directly opened editor", () => {
    const store = createWorkspaceStore(url(1));
    const key = store.getState().activeKey;
    store.getState().refresh(key);
    expect(store.getState().remove([key])).toBe("/admin/workflows");
    expect(store.getState().mounted).toEqual(["menu:workflows"]);
    expect(store.getState().versions).toEqual({});
  });
  it("preserves workflow metadata and other pages while navigating subpages", () => {
    const store = createWorkspaceStore(url(1));
    const key = store.getState().activeKey;
    store.getState().updateMeta(key, { title: "媒体 A", running: true });
    store.getState().visit(url(2));
    store.getState().visit(url(1, "publications"));
    const current = store.getState();
    expect(current.tabs).toHaveLength(3);
    expect(current.tabs.find((tab) => tab.key === key)).toMatchObject({
      title: "媒体 A",
      running: true,
      section: "publications",
    });
    expect(current.mounted).toHaveLength(2);
  });
  it("aggregates independent guards and removes only the closed page, keeping the pinned center", () => {
    const store = createWorkspaceStore(url(1));
    const first = store.getState().activeKey;
    const unregister = store
      .getState()
      .registerGuard(first, "form", { dirty: true, save: vi.fn(async () => false) });
    store.getState().visit(url(2));
    const second = store.getState().activeKey;
    store.getState().registerGuard(second, "form", { dirty: true, busy: true });
    unregister();
    expect(workspaceGuards(store, [first])).toEqual([]);
    expect(workspaceGuards(store, [second])).toHaveLength(1);
    store.getState().remove([second, "menu:workflows"]);
    expect(store.getState().activeKey).toBe(first);
    expect(store.getState().tabs[0].pinned).toBe(true);
    expect(workspaceGuards(store, [second])).toEqual([]);
  });
  it("never replaces a dirty editor when the workspace reaches its capacity", () => {
    const store = createWorkspaceStore(url(1));
    const first = store.getState().activeKey;
    store.getState().registerGuard(first, "draft", { dirty: true });
    for (let i = 2; i < MAX_WORKSPACE_TABS; i++) expect(store.getState().visit(url(i))).toBe(true);
    expect(store.getState().visit(url(99))).toBe(false);
    expect(store.getState().tabs).toHaveLength(MAX_WORKSPACE_TABS);
    expect(store.getState().tabs.find((tab) => tab.key === first)?.dirty).toBe(true);
  });
  it("restores saved order lazily and replaces current query parameters with the actual URL", () => {
    const saved = JSON.stringify([
      { href: url(3) },
      { href: "/admin?tab=models" },
      { href: url(2) },
    ]);
    const store = createWorkspaceStore(url(2, "settings") + "?source=workflow", saved);
    expect(store.getState().tabs.map((tab) => tab.href)).toEqual([
      "/admin/workflows",
      url(3),
      "/admin?tab=models",
      url(2, "settings") + "?source=workflow",
    ]);
    expect(store.getState().mounted).toEqual([store.getState().activeKey]);
    store.getState().reorder(3, 1);
    expect(store.getState().tabs[1].id).toContain("000000000002");
    store.getState().reorder(1, 0);
    expect(store.getState().tabs[0].pinned).toBe(true);
  });
  it("updates an inactive page query without activating it", () => {
    const store = createWorkspaceStore("/admin?tab=assets");
    const assetKey = store.getState().activeKey;
    store.getState().visit(url(1));
    const current = store.getState().activeKey;
    store.getState().setHref(assetKey, "/admin?tab=assets&assetTab=recycle&q=image");
    expect(store.getState().activeKey).toBe(current);
    expect(store.getState().tabs.find((tab) => tab.key === assetKey)?.href).toContain("q=image");
  });
  it("restores the pinned center filters and workflow names without mounting hidden pages", () => {
    const saved = JSON.stringify([
      { href: "/admin/workflows?kind=general&q=customer", title: "工作流中心" },
      { href: url(1), title: "客户查询", subtitle: "通用编排" },
    ]);
    const store = createWorkspaceStore("/admin?tab=models", saved);
    expect(store.getState().tabs[0].href).toContain("q=customer");
    expect(store.getState().tabs[1]).toMatchObject({ title: "客户查询", subtitle: "通用编排" });
    expect(store.getState().mounted).toEqual(["menu:models"]);
  });
});
