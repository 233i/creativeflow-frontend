import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminShell } from "./admin-shell";

describe("AdminShell", () => {
  it("keeps all admin destinations and delegates navigation and logout", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    const onLogout = vi.fn();
    render(
      <AdminShell
        activeTab="users"
        username="admin"
        onTabChange={onTabChange}
        onLogout={onLogout}
        notice={<p role="alert">配置加载失败</p>}
      >
        <h2>用户列表</h2>
      </AdminShell>,
    );
    const navigation = within(screen.getByRole("navigation", { name: "管理功能" }));
    for (const name of [
      "工作流中心",
      "运行中心",
      "模板运营",
      "知识库",
      "凭据管理",
      "渠道管理",
      "模型管理",
      "模型配置",
      "图片生成设置",
      "用户管理",
    ])
      expect(navigation.getByRole("button", { name })).toBeInTheDocument();
    expect(navigation.getByRole("button", { name: "知识库" })).toBeInTheDocument();
    await user.click(navigation.getByRole("button", { name: "凭据管理" }));
    expect(onTabChange).toHaveBeenCalledWith("httpCredentials");
    expect(navigation.getByRole("button", { name: "用户管理" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await user.click(navigation.getByRole("button", { name: "工作流中心" }));
    expect(onTabChange).toHaveBeenCalledWith("workflows");
    await user.click(screen.getByRole("button", { name: "修改密码" }));
    expect(onTabChange).toHaveBeenCalledWith("password");
    await user.click(navigation.getByRole("button", { name: "渠道管理" }));
    expect(onTabChange).toHaveBeenCalledWith("providers");
    await user.click(screen.getByRole("button", { name: "退出" }));
    expect(onLogout).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent("配置加载失败");
    expect(screen.getByRole("link", { name: "返回画布" })).toHaveAttribute("href", "/");
    expect(
      within(screen.getByRole("main")).getByRole("heading", { name: "用户列表" }),
    ).toBeVisible();
  });
});
