import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspacePageContext, type WorkspacePage } from "@/components/providers/workspace-context";
import { useDetailQuery } from "./use-detail-query";
import type { DetailState } from "./use-detail-state";

const data = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), template: vi.fn() }));
vi.mock("@/features/admin/workflow-center/api", () => ({ listWorkflowCenter: data.list }));
vi.mock("@/features/admin/workflow-api", () => ({ editorApi: { getWorkflow: data.get } }));
vi.mock("@/features/admin/api", () => ({ getWorkflowTemplate: data.template }));

beforeEach(() => vi.resetAllMocks());

describe("cached workflow access revalidation", () => {
  it("reloads a template as read-only after it was published from another page", async () => {
    let active = true;
    const page: WorkspacePage = {
      key: "template:one",
      href: "/admin/workflows/one/edit?source=template",
      active,
      navigate: vi.fn(),
      updateLocation: vi.fn(),
      updateMeta: vi.fn(),
      registerGuard: () => () => {},
    };
    const state = {
      id: "one",
      source: "template",
      identity: { id: "admin" },
      retry: 0,
      setItem: vi.fn(),
      setDocument: vi.fn(),
      setSession: vi.fn(),
      setError: vi.fn(),
    };
    data.list.mockResolvedValue({ items: [{ id: "one", templateStatus: "draft" }] });
    data.template.mockResolvedValue({ id: "one", status: "draft", graph: {} });
    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(WorkspacePageContext.Provider, { value: { ...page, active } }, children);
    }
    const { rerender } = renderHook(() => useDetailQuery(state as unknown as DetailState), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(state.setDocument).toHaveBeenCalledTimes(1));
    active = false;
    rerender();
    data.list.mockResolvedValue({ items: [{ id: "one", templateStatus: "published" }] });
    const published = { id: "one", status: "published", graph: {} };
    data.template.mockResolvedValue(published);
    active = true;
    await act(async () => rerender());
    expect(state.setDocument).toHaveBeenLastCalledWith(published);
    expect(state.setSession).toHaveBeenCalledWith(null);
  });
  it("refreshes metadata without replacing a local draft and stops editing a deleted workflow", async () => {
    let active = true;
    const page: WorkspacePage = {
      key: "workflow:one",
      href: "/admin/workflows/one/edit",
      active,
      navigate: vi.fn(),
      updateLocation: vi.fn(),
      updateMeta: vi.fn(),
      registerGuard: () => () => {},
    };
    const state = {
      id: "one",
      source: "workflow",
      identity: { id: "admin" },
      retry: 0,
      setItem: vi.fn(),
      setDocument: vi.fn(),
      setSession: vi.fn(),
      setError: vi.fn(),
    };
    const item = { id: "one", name: "Saved name", deletedAt: null };
    data.list.mockResolvedValue({ items: [item] });
    data.get.mockResolvedValue({ id: "one", graph: {} });
    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(WorkspacePageContext.Provider, { value: { ...page, active } }, children);
    }
    const { rerender } = renderHook(() => useDetailQuery(state as unknown as DetailState), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(state.setDocument).toHaveBeenCalledTimes(1));
    state.setDocument.mockClear();
    active = false;
    rerender();
    active = true;
    rerender();
    await waitFor(() => expect(data.list).toHaveBeenCalledTimes(2));
    expect(data.get).toHaveBeenCalledTimes(1);
    expect(state.setDocument).not.toHaveBeenCalled();
    expect(state.setSession).not.toHaveBeenCalled();
    active = false;
    rerender();
    data.list.mockResolvedValue({ items: [{ ...item, deletedAt: "2026-10-27T00:00:00Z" }] });
    active = true;
    await act(async () => rerender());
    expect(state.setDocument).toHaveBeenCalledWith(null);
    expect(state.setSession).toHaveBeenCalledWith(null);
    expect(state.setItem).toHaveBeenLastCalledWith(
      expect.objectContaining({ deletedAt: expect.any(String) }),
    );
  });
});
