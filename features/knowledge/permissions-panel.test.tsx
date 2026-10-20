import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KnowledgePermissionsPanel } from "./permissions-panel";

const api = vi.hoisted(() => ({ grants: vi.fn(), setGrant: vi.fn(), users: vi.fn() }));
vi.mock("./access-api", () => ({ knowledgeAccessApi: api }));
vi.mock("@/features/admin/api", () => ({ listUsers: api.users }));
const user = {
  id: "user1",
  displayName: "测试账号",
  email: "test@example.invalid",
  isEnabled: true,
};
beforeEach(() => {
  vi.resetAllMocks();
  api.grants.mockResolvedValue({ grants: [], audit: [] });
  api.setGrant.mockResolvedValue(undefined);
  api.users.mockResolvedValue({ users: [user], total: 1 });
});

describe("knowledge permissions", () => {
  it("requires an account, a reason and explicit confirmation", async () => {
    const actions = userEvent.setup();
    render(<KnowledgePermissionsPanel libraryId="lib" />);
    expect(screen.getByRole("button", { name: "添加授权" })).toBeDisabled();
    await screen.findByRole("option", { name: /测试账号/ });
    await actions.selectOptions(screen.getByLabelText("选择授权账号"), "user1");
    await actions.click(screen.getByRole("button", { name: "添加授权" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "确认授权" })).toBeDisabled();
    expect(api.setGrant).not.toHaveBeenCalled();
    await actions.type(within(dialog).getByLabelText("授权调整原因"), "合成资料测试");
    await actions.click(within(dialog).getByRole("button", { name: "确认授权" }));
    await waitFor(() =>
      expect(api.setGrant).toHaveBeenCalledExactlyOnceWith("lib", "user1", true, "合成资料测试"),
    );
  });

  it("does not revoke when confirmation is cancelled", async () => {
    api.grants.mockResolvedValue({
      grants: [
        {
          accountId: user.id,
          displayName: user.displayName,
          email: user.email,
          accountEnabled: true,
          enabled: true,
        },
      ],
      audit: [],
    });
    const actions = userEvent.setup();
    render(<KnowledgePermissionsPanel libraryId="lib" />);
    await actions.click(await screen.findByRole("button", { name: "撤销授权" }));
    expect(screen.getByText(/包括已完成运行/)).toBeInTheDocument();
    await actions.click(within(screen.getByRole("dialog")).getByRole("button", { name: "取消" }));
    expect(api.setGrant).not.toHaveBeenCalled();
  });

  it("keeps a successful write closed when the following read fails", async () => {
    const actions = userEvent.setup();
    render(<KnowledgePermissionsPanel libraryId="lib" />);
    await screen.findByRole("option", { name: /测试账号/ });
    await actions.selectOptions(screen.getByLabelText("选择授权账号"), "user1");
    await actions.click(screen.getByRole("button", { name: "添加授权" }));
    api.grants.mockRejectedValue(new Error("重新读取失败"));
    await actions.type(screen.getByLabelText("授权调整原因"), "test");
    await actions.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "确认授权" }),
    );
    await screen.findByText("重新读取失败");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.setGrant).toHaveBeenCalledOnce();
  });
});
