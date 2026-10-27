import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceCloseDialog } from "./close-dialog";
import { createWorkspaceStore } from "./store";

describe("workspace close protection", () => {
  it("keeps every page open when one save fails and never invokes subsequent save operations", async () => {
    const store = createWorkspaceStore("/admin?tab=models");
    const key = store.getState().activeKey;
    const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const second = vi.fn(async () => true);
    store.getState().registerGuard(key, "first", { dirty: true, save });
    store.getState().registerGuard(key, "second", { dirty: true, save: second });
    const proceed = vi.fn();
    render(
      <WorkspaceCloseDialog
        store={store}
        pending={{ keys: [key], title: "关闭测试", proceed }}
        onCancel={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "保存并继续" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("页面已保留");
    expect(proceed).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "保存并继续" }));
    await waitFor(() => expect(proceed).toHaveBeenCalledOnce());
    expect(second).toHaveBeenCalledOnce();
  });
  it("requires explicit discard for actions without a safe save operation", async () => {
    const store = createWorkspaceStore("/admin?tab=password");
    const key = store.getState().activeKey;
    const discard = vi.fn();
    const proceed = vi.fn();
    store.getState().registerGuard(key, "password", { dirty: true, discard });
    render(
      <WorkspaceCloseDialog
        store={store}
        pending={{ keys: [key], title: "关闭密码页", proceed }}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "保存并继续" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "放弃修改并继续" }));
    expect(discard).toHaveBeenCalledOnce();
    expect(proceed).toHaveBeenCalledOnce();
  });
});
