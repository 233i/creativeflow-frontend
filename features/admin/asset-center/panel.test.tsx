import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetItem, AssetDeletionPreview } from "@/features/assets/api";

vi.mock("@/features/assets/api", async (original) => ({
  ...(await original<typeof import("@/features/assets/api")>()),
  listManagedAssets: vi.fn(),
  assetFacets: vi.fn(),
  getManagedAsset: vi.fn(),
  previewAssetDeletion: vi.fn(),
  manageAsset: vi.fn(),
  batchAssets: vi.fn(),
  uploadManagedAsset: vi.fn(),
  downloadAssets: vi.fn(),
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
const { AssetCenterPanel } = await import("./panel");
const { AssetActionDialog } = await import("./action-dialog");

const asset: AssetItem = {
  id: "aaaaaaaa-0000-4000-8000-000000000001",
  name: "产品图",
  kind: "image",
  mediaType: "image/png",
  byteSize: 128,
  source: "generated",
  state: "active",
  accountId: null,
  owner: "合成用户",
  groupId: null,
  groupName: null,
  tags: [],
  createdAt: "2026-09-19T08:00:00Z",
  deletedAt: null,
  purgedAt: null,
  isPublic: false,
  referenceCount: 0,
  width: 100,
  height: 100,
  duration: null,
  revision: "3",
  url: "/synthetic/content",
  thumbnailUrl: "/synthetic/thumbnail",
  canManage: true,
};
const preview: AssetDeletionPreview = {
  asset,
  references: [],
  canRecycle: true,
  canPurge: false,
  canPurgeHistory: false,
  eligibleAt: null,
  blockers: [],
  retentionDays: 7,
};
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState({}, "", "/admin?tab=assets");
  vi.mocked(api.listManagedAssets).mockResolvedValue({
    items: [asset],
    total: 61,
    offset: 0,
    limit: 30,
  });
  vi.mocked(api.assetFacets).mockResolvedValue({ groups: [], owners: [], tags: [] });
  vi.mocked(api.previewAssetDeletion).mockResolvedValue(preview);
  vi.mocked(api.manageAsset).mockResolvedValue({
    id: asset.id,
    status: "recycled",
    message: "已移入回收站",
    logicalBytes: 0,
  });
});

describe("asset center", () => {
  it("clears selection when browser history changes the asset scope", async () => {
    const user = userEvent.setup();
    render(<AssetCenterPanel />);
    await user.click(await screen.findByRole("checkbox", { name: "选择 产品图" }));
    expect(screen.getByText("已选 1/50")).toBeInTheDocument();
    act(() => {
      window.history.replaceState({}, "", "/admin?tab=assets&assetTab=recycle&assetPage=2");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByText("已选 0/50")).toBeInTheDocument();
    await waitFor(() =>
      expect(api.listManagedAssets).toHaveBeenLastCalledWith(
        expect.objectContaining({ state: "recycled", offset: 30 }),
        expect.any(AbortSignal),
      ),
    );
  });
  it("paginates and filters on the server and clears page selection", async () => {
    const user = userEvent.setup();
    render(<AssetCenterPanel />);
    await screen.findByRole("checkbox", { name: "选择 产品图" });
    await user.click(screen.getByRole("checkbox", { name: "选择 产品图" }));
    expect(screen.getByText("已选 1/50")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() =>
      expect(api.listManagedAssets).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 30, limit: 30 }),
        expect.any(AbortSignal),
      ),
    );
    expect(screen.getByText("已选 0/50")).toBeInTheDocument();
    await user.click(screen.getByLabelText("资产类型"));
    await user.click(await screen.findByText("视频", { selector: ".t-select-option span" }));
    await waitFor(() =>
      expect(api.listManagedAssets).toHaveBeenLastCalledWith(
        expect.objectContaining({ kind: "video", offset: 0 }),
        expect.any(AbortSignal),
      ),
    );
  });

  it("ignores the old list after changing the URL filter", async () => {
    let resolve!: (page: Awaited<ReturnType<typeof api.listManagedAssets>>) => void;
    vi.mocked(api.listManagedAssets).mockReturnValueOnce(
      new Promise((value) => {
        resolve = value;
      }),
    );
    const user = userEvent.setup();
    render(<AssetCenterPanel />);
    await waitFor(() => expect(api.listManagedAssets).toHaveBeenCalledTimes(1));
    const previousSignal = vi.mocked(api.listManagedAssets).mock.calls[0][1]!;
    const video = { ...asset, id: "video", name: "新范围的视频", kind: "video" as const };
    vi.mocked(api.listManagedAssets).mockResolvedValue({
      items: [video],
      total: 1,
      offset: 0,
      limit: 30,
    });
    await user.click(screen.getByLabelText("资产类型"));
    await user.click(await screen.findByText("视频", { selector: ".t-select-option span" }));
    await screen.findByRole("checkbox", { name: "选择 新范围的视频" });
    await act(async () => {
      resolve({ items: [asset], total: 1, offset: 0, limit: 30 });
    });
    expect(previousSignal.aborted).toBe(true);
    expect(screen.queryByRole("checkbox", { name: "选择 产品图" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "选择 新范围的视频" })).toBeInTheDocument();
  });

  it("reports partial upload failures and continues the remaining files", async () => {
    vi.mocked(api.uploadManagedAsset)
      .mockResolvedValueOnce({ assetId: "a" })
      .mockRejectedValueOnce(new Error("文件损坏"))
      .mockResolvedValueOnce({ assetId: "c" });
    render(<AssetCenterPanel />);
    const files = ["first.png", "broken.png", "last.png"].map(
      (name) => new File(["image"], name, { type: "image/png" }),
    );
    fireEvent.change(screen.getByLabelText("上传资产图片"), { target: { files } });
    expect(await screen.findByRole("alert")).toHaveTextContent("broken.png：文件损坏");
    expect(screen.getByText(/已上传 2\/3/)).toBeInTheDocument();
    expect(api.uploadManagedAsset).toHaveBeenCalledTimes(3);
    expect(api.uploadManagedAsset).toHaveBeenLastCalledWith(files[2]);
  });

  it("does not start queued uploads after leaving the asset center", async () => {
    let resolve!: (value: { assetId: string }) => void;
    vi.mocked(api.uploadManagedAsset).mockReturnValueOnce(
      new Promise((value) => {
        resolve = value;
      }),
    );
    const view = render(<AssetCenterPanel />);
    const files = ["first.png", "next.png"].map(
      (name) => new File(["image"], name, { type: "image/png" }),
    );
    fireEvent.change(screen.getByLabelText("上传资产图片"), { target: { files } });
    fireEvent.change(screen.getByLabelText("上传资产图片"), { target: { files } });
    view.unmount();
    await act(async () => {
      resolve({ assetId: "first" });
    });
    expect(api.uploadManagedAsset).toHaveBeenCalledExactlyOnceWith(files[0]);
  });

  it("preserves per-item batch results and the revisions captured at confirmation", async () => {
    const second = { ...asset, id: "second", name: "受保护素材", revision: "7" };
    vi.mocked(api.listManagedAssets).mockResolvedValue({
      items: [asset, second],
      total: 2,
      offset: 0,
      limit: 30,
    });
    vi.mocked(api.batchAssets).mockResolvedValue([
      { id: asset.id, status: "recycled", message: "产品图已回收", logicalBytes: 128 },
      { id: second.id, status: "blocked", message: "受保护素材仍被引用", logicalBytes: 0 },
    ]);
    const user = userEvent.setup();
    render(<AssetCenterPanel />);
    await screen.findByRole("checkbox", { name: "选择 产品图" });
    await user.click(screen.getByRole("checkbox", { name: "选择本页资产" }));
    await user.click(screen.getByRole("button", { name: "移入回收站" }));
    await user.type(screen.getByLabelText("批量操作原因"), "整理过期资料");
    await user.click(screen.getByRole("checkbox", { name: /我已核对所选 2 项/ }));
    await user.click(screen.getByRole("button", { name: "确认执行" }));
    expect(await screen.findByText("产品图已回收")).toBeInTheDocument();
    expect(screen.getByText("受保护素材仍被引用")).toBeInTheDocument();
    expect(api.batchAssets).toHaveBeenCalledExactlyOnceWith({
      action: "recycle",
      ids: [asset.id, second.id],
      revisions: { [asset.id]: "3", [second.id]: "7" },
      reason: "整理过期资料",
    });
    await user.click(screen.getByRole("button", { name: "完成" }));
    expect(screen.getByText("已选 0/50")).toBeInTheDocument();
  });

  it("cancels batch confirmation without sending a mutation", async () => {
    const user = userEvent.setup();
    render(<AssetCenterPanel />);
    await user.click(await screen.findByRole("checkbox", { name: "选择 产品图" }));
    await user.click(screen.getByRole("button", { name: "移入回收站" }));
    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(api.batchAssets).not.toHaveBeenCalled();
    expect(screen.getByText("已选 1/50")).toBeInTheDocument();
  });

  it("does not restore an old selection after a failed refresh and a successful retry", async () => {
    const user = userEvent.setup();
    render(<AssetCenterPanel />);
    await user.click(await screen.findByRole("checkbox", { name: "选择 产品图" }));
    vi.mocked(api.listManagedAssets).mockRejectedValueOnce(new api.AssetApiError("权限失效", 403));
    await user.click(screen.getByRole("button", { name: "刷新资产" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("权限失效");
    await user.click(screen.getByRole("button", { name: "重新查询" }));
    expect(await screen.findByRole("checkbox", { name: "选择 产品图" })).not.toBeChecked();
  });

  it("shows private/public/recycle states as distinct server filters", async () => {
    const user = userEvent.setup();
    render(<AssetCenterPanel />);
    await user.click(screen.getByRole("tab", { name: "公共素材" }));
    await waitFor(() =>
      expect(api.listManagedAssets).toHaveBeenCalledWith(
        expect.objectContaining({ public: true, state: "active" }),
        expect.any(AbortSignal),
      ),
    );
    await user.click(screen.getByRole("tab", { name: "回收站" }));
    await waitFor(() =>
      expect(api.listManagedAssets).toHaveBeenLastCalledWith(
        expect.objectContaining({ public: false, state: "recycled" }),
        expect.any(AbortSignal),
      ),
    );
  });

  it("requires reason and fresh impact revision before recycle", async () => {
    const user = userEvent.setup();
    const done = vi.fn();
    render(<AssetActionDialog asset={asset} action="recycle" onClose={vi.fn()} onDone={done} />);
    const reason = await screen.findByRole("textbox", { name: "操作原因" });
    expect(screen.getByRole("button", { name: "移入回收站" })).toBeDisabled();
    await user.type(reason, "重复测试素材");
    await user.click(screen.getByRole("button", { name: "移入回收站" }));
    expect(api.manageAsset).toHaveBeenCalledExactlyOnceWith(
      asset.id,
      "recycle",
      expect.objectContaining({ revision: "3", reason: "重复测试素材", allowHistory: false }),
    );
    expect(done).toHaveBeenCalledWith("已移入回收站");
  });

  it("blocks referenced originals even with a name and reason", async () => {
    vi.mocked(api.previewAssetDeletion).mockResolvedValue({
      ...preview,
      asset: { ...asset, state: "recycled" },
      canRecycle: false,
      blockers: ["工作流草稿仍在引用"],
    });
    const user = userEvent.setup();
    render(<AssetActionDialog asset={asset} action="purge" onClose={vi.fn()} onDone={vi.fn()} />);
    await user.type(await screen.findByRole("textbox", { name: "确认资产名称" }), asset.name);
    await user.type(screen.getByRole("textbox", { name: "操作原因" }), "清理测试");
    expect(screen.getByText("工作流草稿仍在引用")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "永久清理原件" })).toBeDisabled();
    expect(api.manageAsset).not.toHaveBeenCalled();
  });

  it("does not automatically retry an ambiguous mutation and invalidates its confirmation", async () => {
    vi.mocked(api.manageAsset).mockRejectedValue(new Error("连接中断"));
    const user = userEvent.setup();
    render(<AssetActionDialog asset={asset} action="recycle" onClose={vi.fn()} onDone={vi.fn()} />);
    await user.type(await screen.findByRole("textbox", { name: "操作原因" }), "整理");
    await user.click(screen.getByRole("button", { name: "移入回收站" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("不会自动重试");
    expect(screen.getByRole("button", { name: "移入回收站" })).toBeDisabled();
    expect(api.manageAsset).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "重新查询" }));
    await screen.findByRole("textbox", { name: "操作原因" });
    expect(api.previewAssetDeletion).toHaveBeenCalledTimes(2);
    expect(api.manageAsset).toHaveBeenCalledTimes(1);
  });

  it("requires a fresh preview after a revision conflict before an explicit retry", async () => {
    vi.mocked(api.manageAsset).mockRejectedValueOnce(new api.AssetApiError("资产修订冲突", 409));
    vi.mocked(api.previewAssetDeletion)
      .mockResolvedValueOnce(preview)
      .mockResolvedValue({ ...preview, asset: { ...asset, revision: "4" } });
    const user = userEvent.setup();
    render(<AssetActionDialog asset={asset} action="recycle" onClose={vi.fn()} onDone={vi.fn()} />);
    await user.type(await screen.findByLabelText("操作原因"), "确认整理");
    await user.click(screen.getByRole("button", { name: "移入回收站" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("资产修订冲突");
    expect(screen.getByRole("button", { name: "移入回收站" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "重新查询" }));
    await screen.findByLabelText("操作原因");
    expect(api.manageAsset).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "移入回收站" }));
    expect(api.manageAsset).toHaveBeenLastCalledWith(
      asset.id,
      "recycle",
      expect.objectContaining({ revision: "4", reason: "确认整理" }),
    );
  });
});
