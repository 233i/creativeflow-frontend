import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkflowApiError } from "@/features/workflow/api";
import { listWorkflowCenter, type CenterPage } from "../api";
import { useCenterQuery } from "./use-center-query";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/admin/workflow-api", () => ({
  editorApi: { getWorkflowCapabilities: vi.fn(async () => ({ enabled: true })) },
}));
vi.mock("../api", async (original) => ({
  ...(await original<typeof import("../api")>()),
  listWorkflowCenter: vi.fn(),
}));
const empty: CenterPage = { items: [], total: 0, offset: 0, limit: 30 };
const tick = async () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  window.history.replaceState({}, "", "/admin?tab=workflows&q=first&page=2&size=30");
  vi.mocked(listWorkflowCenter).mockResolvedValue(empty);
});
afterEach(() => vi.useRealTimers());
describe("workflow center queries", () => {
  it("restores URL filters and ignores an old response after navigation", async () => {
    let finish!: (value: CenterPage) => void;
    vi.mocked(listWorkflowCenter).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const hook = renderHook(() => useCenterQuery(""));
    await tick();
    expect(hook.result.current.query.search).toBe("first");
    expect(hook.result.current.currentPage).toBe(2);
    act(() => hook.result.current.update({ q: "second", page: null }));
    await tick();
    await act(async () => finish({ ...empty, total: 999 }));
    expect(hook.result.current.query.search).toBe("second");
    expect(hook.result.current.page?.total).toBe(0);
    expect(vi.mocked(listWorkflowCenter).mock.calls[0][1]?.aborted).toBe(true);
  });
  it("clears cached records and run preview after authorization expires", async () => {
    const hook = renderHook(() => useCenterQuery(""));
    await tick();
    vi.mocked(listWorkflowCenter).mockRejectedValueOnce(new WorkflowApiError("expired", 403, []));
    act(() => hook.result.current.setRefresh((value) => value + 1));
    await tick();
    expect(hook.result.current.page).toBeNull();
    expect(hook.result.current.selected).toBeNull();
    expect(hook.result.current.error).toBe("expired");
  });
});
