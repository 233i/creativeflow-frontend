import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assetFixture, detailFixture, deferred } from "@/features/assets/test-fixtures";

vi.mock("@/features/assets/api", async (original) => ({
  ...(await original<typeof import("@/features/assets/api")>()),
  getManagedAsset: vi.fn(),
  updateManagedAsset: vi.fn(),
  extractManagedFrame: vi.fn(),
}));
vi.mock("../detail-drawer", () => ({
  DetailDrawer: ({
    children,
    actions,
  }: {
    children: React.ReactNode;
    actions: React.ReactNode;
  }) => (
    <aside>
      {children}
      {actions}
    </aside>
  ),
}));
const api = await import("@/features/assets/api");
const { AssetDetailDrawer } = await import("./detail");
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getManagedAsset).mockResolvedValue(detailFixture());
});

describe("managed asset detail session", () => {
  it("keeps edited fields after a revision conflict without silently retrying", async () => {
    vi.mocked(api.updateManagedAsset).mockRejectedValue(new api.AssetApiError("修订冲突", 409));
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(
      <AssetDetailDrawer
        id="asset-a"
        revision={0}
        onChanged={onChanged}
        onClose={vi.fn()}
        onAction={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const name = await screen.findByLabelText("资产名称");
    await user.clear(name);
    await user.type(name, "New name");
    await user.type(screen.getByLabelText("资产标签"), "one, one，two");
    await user.type(screen.getByLabelText("修改原因"), "Organize");
    await user.click(screen.getByRole("button", { name: "保存资料" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("修订冲突");
    expect(name).toHaveValue("New name");
    expect(screen.getByLabelText("修改原因")).toHaveValue("Organize");
    expect(api.updateManagedAsset).toHaveBeenCalledExactlyOnceWith("asset-a", {
      name: "New name",
      tags: ["one", "two"],
      reason: "Organize",
      revision: "3",
    });
    expect(onChanged).not.toHaveBeenCalled();
  });
  it("ignores late frame extraction after selecting a different asset", async () => {
    const pending = deferred<{ assetId: string }>();
    vi.mocked(api.getManagedAsset)
      .mockResolvedValueOnce(detailFixture(assetFixture({ kind: "video", mediaType: "video/mp4" })))
      .mockResolvedValue(detailFixture(assetFixture({ id: "asset-b", name: "Asset B" })));
    vi.mocked(api.extractManagedFrame).mockReturnValue(pending.promise);
    const callbacks = {
      onChanged: vi.fn(),
      onClose: vi.fn(),
      onAction: vi.fn(),
      onSelect: vi.fn(),
    };
    const user = userEvent.setup();
    const view = render(<AssetDetailDrawer id="asset-a" revision={0} {...callbacks} />);
    await user.click(await screen.findByRole("button", { name: "提取尾帧" }));
    view.rerender(<AssetDetailDrawer id="asset-b" revision={0} {...callbacks} />);
    expect(await screen.findByLabelText("资产名称")).toHaveValue("Asset B");
    await act(async () => pending.resolve({ assetId: "old-frame" }));
    expect(callbacks.onSelect).not.toHaveBeenCalled();
    expect(callbacks.onChanged).not.toHaveBeenCalled();
  });
  it("clears old media after a refresh loses authorization", async () => {
    const callbacks = {
      onChanged: vi.fn(),
      onClose: vi.fn(),
      onAction: vi.fn(),
      onSelect: vi.fn(),
    };
    const view = render(<AssetDetailDrawer id="asset-a" revision={0} {...callbacks} />);
    await screen.findByLabelText("资产名称");
    vi.mocked(api.getManagedAsset).mockRejectedValue(new api.AssetApiError("不可访问", 403));
    view.rerender(<AssetDetailDrawer id="asset-a" revision={1} {...callbacks} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("不可访问");
    expect(screen.queryByRole("img", { name: "Asset A" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("资产名称")).not.toBeInTheDocument();
  });
});
