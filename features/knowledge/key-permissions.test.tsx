import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KnowledgeKeyPermissions } from "./key-permissions";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  keys: vi.fn(),
  grants: vi.fn(),
  setApiKeyGrant: vi.fn(),
}));
vi.mock("@/features/admin/workflow-api", () => ({ listWorkflowApis: api.list }));
vi.mock("@/features/workflow/external-api/api", () => ({ listApiKeys: api.keys }));
vi.mock("./access-api", () => ({ knowledgeAccessApi: api }));
beforeEach(() => {
  vi.resetAllMocks();
  api.list.mockResolvedValue({ apis: [{ id: "wf", name: "合成问答", version: 1 }] });
  api.keys.mockResolvedValue({
    apiKeys: [
      {
        id: "key-record",
        name: "测试外部客户",
        prefix: "cf_live_test",
        enabled: true,
        revokedAt: null,
        expiresAt: null,
      },
    ],
  });
  api.grants.mockResolvedValue({ grants: [], audit: [], apiKeys: [], apiKeyAudit: [] });
  api.setApiKeyGrant.mockResolvedValue(undefined);
});

describe("knowledge API Key grants", () => {
  it("selects a workflow and Key record, requires reason and explicitly confirms once", async () => {
    const user = userEvent.setup();
    render(<KnowledgeKeyPermissions libraryId="library" />);
    await screen.findByRole("option", { name: /合成问答/ });
    await user.selectOptions(screen.getByLabelText("Key 所属工作流"), "wf");
    await screen.findByRole("option", { name: /测试外部客户/ });
    await user.selectOptions(screen.getByLabelText("选择授权 Key"), "key-record");
    await user.click(screen.getByRole("button", { name: "授权 Key" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "确认授权" })).toBeDisabled();
    expect(api.setApiKeyGrant).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Key 授权调整原因"), "合成集成测试");
    await user.click(within(dialog).getByRole("button", { name: "确认授权" }));
    await waitFor(() =>
      expect(api.setApiKeyGrant).toHaveBeenCalledExactlyOnceWith(
        "library",
        "key-record",
        true,
        "合成集成测试",
      ),
    );
    expect(api.keys).toHaveBeenCalledWith("wf");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hides revoked and expired Keys and never grants one automatically", async () => {
    api.keys.mockResolvedValue({
      apiKeys: [
        { id: "revoked", name: "已撤销", enabled: false },
        { id: "expired", name: "已到期", enabled: true, expiresAt: "2000-01-01T00:00:00Z" },
      ],
    });
    const user = userEvent.setup();
    render(<KnowledgeKeyPermissions libraryId="library" />);
    await screen.findByRole("option", { name: /合成问答/ });
    await user.selectOptions(screen.getByLabelText("Key 所属工作流"), "wf");
    await waitFor(() => expect(screen.getByLabelText("选择授权 Key")).not.toBeDisabled());
    expect(screen.queryByRole("option", { name: /已撤销|已到期/ })).toBeNull();
    expect(screen.getByRole("button", { name: "授权 Key" })).toBeDisabled();
    expect(api.setApiKeyGrant).not.toHaveBeenCalled();
  });

  it("cancelling revocation preserves the existing permission", async () => {
    api.grants.mockResolvedValue({
      grants: [],
      audit: [],
      apiKeys: [
        {
          apiKeyId: "key-record",
          name: "测试客户",
          workflowName: "合成问答",
          enabled: true,
          keyEnabled: true,
        },
      ],
      apiKeyAudit: [],
    });
    const user = userEvent.setup();
    render(<KnowledgeKeyPermissions libraryId="library" />);
    await user.click(await screen.findByRole("button", { name: "撤销 Key 授权" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "取消" }));
    expect(api.setApiKeyGrant).not.toHaveBeenCalled();
  });
});
