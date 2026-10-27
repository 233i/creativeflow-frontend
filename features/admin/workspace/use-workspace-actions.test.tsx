import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceStore } from "./store";
import { useWorkspaceActions } from "./use-workspace-actions";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
const first = "/admin/workflows/10000000-0000-4000-8000-000000000001/edit";
const second = "/admin/workflows/10000000-0000-4000-8000-000000000002/edit";
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", first);
});

describe("workspace navigation and destructive view changes", () => {
  it("opens another menu without discarding or saving the current draft, and restores that menu's filters", () => {
    const store = createWorkspaceStore(first);
    const draft = store.getState().activeKey;
    const save = vi.fn(async () => true);
    store.getState().registerGuard(draft, "draft", { dirty: true, save });
    store.getState().visit("/admin?tab=assets&q=retained&assetPage=3");
    store.getState().visit(first);
    const hook = renderHook(() => useWorkspaceActions(store, first));
    act(() => hook.result.current.menu("assets"));
    expect(navigation.push).toHaveBeenLastCalledWith("/admin?tab=assets&q=retained&assetPage=3", {
      scroll: false,
    });
    expect(save).not.toHaveBeenCalled();
    expect(store.getState().tabs.find((tab) => tab.key === draft)?.dirty).toBe(true);
    expect(hook.result.current.pending).toBeNull();
  });
  it("protects only pages selected for closing and cancels without changing the current view", () => {
    const store = createWorkspaceStore(first);
    const key = store.getState().activeKey;
    store.getState().registerGuard(key, "draft", { dirty: true });
    store.getState().visit(second);
    const active = store.getState().activeKey;
    const hook = renderHook(() => useWorkspaceActions(store, second));
    act(() => hook.result.current.action("close", key));
    expect(hook.result.current.pending?.keys).toEqual([key]);
    expect(store.getState().activeKey).toBe(active);
    act(() => hook.result.current.setPending(null));
    expect(store.getState().tabs).toHaveLength(3);
    expect(navigation.replace).not.toHaveBeenCalled();
  });
  it("allows browser history between workflows but guards leaving the workspace", () => {
    const store = createWorkspaceStore(first);
    store.getState().registerGuard(store.getState().activeKey, "draft", { dirty: true });
    const hook = renderHook(() => useWorkspaceActions(store, first));
    act(() => {
      window.history.pushState(null, "", second);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(hook.result.current.pending).toBeNull();
    act(() => {
      window.history.pushState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(window.location.pathname).toBe(first);
    expect(hook.result.current.pending?.title).toBe("切换页面前处理修改");
  });
  it("guards browser history that would unmount an unsaved workflow settings form", () => {
    const settings = first.replace("/edit", "/settings");
    window.history.replaceState(null, "", settings);
    const store = createWorkspaceStore(settings);
    store
      .getState()
      .registerGuard(store.getState().activeKey, "settings", { dirty: true, leaveSection: true });
    const hook = renderHook(() => useWorkspaceActions(store, settings));
    act(() => {
      window.history.pushState(null, "", first);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(window.location.pathname).toBe(settings);
    expect(hook.result.current.pending).not.toBeNull();
  });
  it("retains browser refresh protection for inactive dirty pages", () => {
    const store = createWorkspaceStore(first);
    store.getState().registerGuard(store.getState().activeKey, "draft", { dirty: true });
    store.getState().visit(second);
    renderHook(() => useWorkspaceActions(store, second));
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
