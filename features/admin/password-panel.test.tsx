import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
}));

vi.mock("@/features/admin/api", () => ({
  AdminApiError: class AdminApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
      readonly details: string[] = [],
    ) {
      super(message);
    }
  },
  changePassword: mocks.changePassword,
}));

const { PasswordPanel } = await import("@/features/admin/password-panel");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.changePassword.mockResolvedValue(undefined);
});

describe("PasswordPanel", () => {
  it("keeps save clickable and explains invalid input instead of silently disabling it", async () => {
    const user = userEvent.setup();
    render(<PasswordPanel username="admin" onChanged={vi.fn()} />);

    const save = screen.getByRole("button", { name: "保存新密码" });
    expect(save).toBeEnabled();

    await user.click(save);

    expect(await screen.findByText("请输入当前密码")).toBeInTheDocument();
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it("submits valid credentials and confirms the password change", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    render(<PasswordPanel username="admin" onChanged={onChanged} />);

    await user.type(screen.getByPlaceholderText("请输入当前管理员密码"), "123456");
    await user.type(screen.getByPlaceholderText("至少 10 个字符"), "new-secure-password");
    await user.type(screen.getByPlaceholderText("再次输入新密码"), "new-secure-password");
    await user.click(screen.getByRole("button", { name: "保存新密码" }));

    await waitFor(() => {
      expect(mocks.changePassword).toHaveBeenCalledWith("123456", "new-secure-password");
    });
    expect(onChanged).toHaveBeenCalledOnce();
    expect(screen.getByText("管理员密码已更新，请使用新密码登录。")).toBeInTheDocument();
  });
});
