import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasAssetGroupSummary, CanvasAssetSummary } from "@/features/canvas/api";
import type { AssetItem, AssetQuery } from "@/features/assets/api";

const STRINGS: Record<string, string> = {
  "common.add": "Add",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.retry": "Retry",
  "canvas.assetLibrary": "Asset library",
  "canvas.assetLibraryHint": "Reusable assets.",
  "canvas.assetPickerHint": "Reuse an image in the current node.",
  "canvas.assetUseImage": "Use this image",
  "canvas.assetGroupDragHint": "Drop on a group.",
  "canvas.assetAll": "All assets",
  "canvas.assetUngrouped": "Ungrouped",
  "canvas.assetGroups": "Groups",
  "canvas.assetGroupCreate": "New group",
  "canvas.assetGroupNamePlaceholder": "Group name",
  "canvas.assetGroupNameRequired": "Enter a name",
  "canvas.assetGroupNameDuplicate": "Duplicate group",
  "canvas.assetGroupRename": "Rename group",
  "canvas.assetGroupDelete": "Delete group",
  "canvas.assetGroupDeleteConfirm": "Delete {name}?",
  "canvas.assetGroupEmpty": "No groups",
  "canvas.assetGroupEmptyHint": "Create one.",
  "canvas.assetGroupNoAssets": "No assets here",
  "canvas.assetGroupMove": "Move to group",
  "canvas.assetGroupMoveNone": "Remove from group",
  "canvas.assetGroupCount": "{count} assets",
  "canvas.assetSelect": "Select asset",
  "canvas.promptSelected": "{count} selected",
  "canvas.assetLibraryEmpty": "Empty",
  "canvas.assetLibraryEmptyHint": "Upload something.",
  "canvas.assetDeleteConfirm": "Delete asset?",
  "errors.unknown": "Unknown error",
};

const translate = (key: string, values?: Record<string, string | number>) => {
  const template = STRINGS[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    values && name in values ? String(values[name]) : match,
  );
};

vi.mock("@/components/providers/i18n-provider", () => ({
  useT: () => translate,
}));

// 实际对话框是带焦点管理的 Portal。这些测试关注素材库自身的状态变化，
// 因此使用语义化包装器可让测试保持聚焦且结果稳定。
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <footer>{children}</footer>,
}));

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({
    isOpen,
    title,
    onConfirm,
  }: {
    isOpen: boolean;
    title: string;
    onConfirm: () => void | Promise<void>;
  }) =>
    isOpen ? (
      <button type="button" onClick={() => void onConfirm()}>
        confirm:{title}
      </button>
    ) : null,
}));

vi.mock("@/features/canvas/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/canvas/api")>()),
  listAssets: vi.fn(),
  listAssetGroups: vi.fn(),
  createAssetGroup: vi.fn(),
  renameAssetGroup: vi.fn(),
  deleteAssetGroup: vi.fn(),
  assignAssetsToGroup: vi.fn(),
  deleteAsset: vi.fn(),
}));

const api = await import("@/features/canvas/api");
vi.mock("@/features/assets/api", async (original) => ({
  ...(await original<typeof import("@/features/assets/api")>()),
  listLibraryAssets: vi.fn(),
  getLibraryAsset: vi.fn(),
  reusePublicAsset: vi.fn(),
  restoreLibraryAsset: vi.fn(),
}));
const library = await import("@/features/assets/api");
const { AssetLibraryDialog } = await import("@/features/canvas/asset-library-dialog");
const { useCanvasStore } = await import("@/features/canvas/store");

function asset(id: string, prompt: string, groupId: string | null): CanvasAssetSummary {
  return {
    id,
    url: `/api/v1/canvas/assets/${id}`,
    kind: "image",
    mediaType: "image/png",
    byteSize: 100,
    prompt,
    createdAt: "2026-08-06T00:00:00.000Z",
    groupId,
  };
}

function group(id: string, name: string, assetCount: number): CanvasAssetGroupSummary {
  return {
    id,
    name,
    assetCount,
    createdAt: "2026-08-06T00:00:00.000Z",
    updatedAt: "2026-08-06T00:00:00.000Z",
  };
}

function managed(asset: CanvasAssetSummary): AssetItem {
  return {
    ...asset,
    name: asset.prompt ?? asset.id,
    state: "active",
    source: "upload",
    tags: [],
    accountId: null,
    owner: "Owner",
    groupName: null,
    deletedAt: null,
    purgedAt: null,
    isPublic: false,
    referenceCount: 0,
    width: null,
    height: null,
    duration: null,
    revision: "1",
    thumbnailUrl: asset.url + "/thumbnail",
    canManage: true,
  };
}

function renderLibrary() {
  return render(<AssetLibraryDialog onOpenChange={vi.fn()} at={() => ({ x: 0, y: 0 })} />);
}

beforeEach(() => {
  vi.resetAllMocks();
  useCanvasStore.getState().reset();

  vi.mocked(api.listAssets).mockResolvedValue({
    assets: [asset("a", "Alpha", "g1"), asset("b", "Beta", null)],
  });
  vi.mocked(api.listAssetGroups).mockResolvedValue({
    groups: [group("g1", "Mood", 1)],
  });
  vi.mocked(api.assignAssetsToGroup).mockResolvedValue({ updated: 1 });
  vi.mocked(api.deleteAssetGroup).mockResolvedValue(undefined);
  vi.mocked(library.getLibraryAsset).mockImplementation(async (id) => {
    const value = (await api.listAssets()).assets.find((asset) => asset.id === id)!;
    return {
      asset: managed(value),
      prompt: value.prompt,
      sha256: null,
      references: [],
      origins: [],
      audit: [],
      referencesComplete: true,
    };
  });
  vi.mocked(library.listLibraryAssets).mockImplementation(async (query: AssetQuery) => {
    const result = await api.listAssets(query.kind === "image" ? "image" : undefined);
    const items = result.assets
      .map(managed)
      .filter(
        (a) =>
          (!query.kind || a.kind === query.kind) &&
          (!query.groupId || a.groupId === query.groupId) &&
          (!query.ungrouped || !a.groupId),
      );
    return { items, total: items.length, offset: query.offset ?? 0, limit: 24 };
  });
});

describe("AssetLibraryDialog groups", () => {
  it("restores the original group view and selection when an optimistic move is rejected", async () => {
    vi.mocked(api.assignAssetsToGroup).mockRejectedValueOnce(new Error("无权移动"));
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole("button", { name: "Alpha" });
    await user.click(screen.getByRole("button", { name: /Mood/ }));
    await user.click(screen.getByRole("button", { name: "Alpha" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Move to group" }),
      "__ungrouped__",
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("无权移动");
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Mood/ })).toHaveTextContent("1");
  });

  it("ignores an older asset list after a new search resolves", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof library.listLibraryAssets>>) => void;
    vi.mocked(library.listLibraryAssets).mockReturnValueOnce(
      new Promise((value) => {
        resolve = value;
      }),
    );
    renderLibrary();
    await waitFor(() => expect(library.listLibraryAssets).toHaveBeenCalledTimes(1));
    vi.mocked(library.listLibraryAssets).mockResolvedValueOnce({
      items: [managed(asset("b", "Latest", null))],
      total: 1,
      offset: 0,
      limit: 24,
    });
    fireEvent.change(screen.getByLabelText("搜索素材"), { target: { value: "latest" } });
    await screen.findByRole("button", { name: "Latest" });
    await act(async () => {
      resolve({ items: [managed(asset("a", "Old", null))], total: 1, offset: 0, limit: 24 });
    });
    expect(screen.queryByRole("button", { name: "Old" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Latest" })).toBeInTheDocument();
  });

  it("abandons an inline rename on Escape without committing on blur", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole("button", { name: "Alpha" });
    await user.click(screen.getByRole("button", { name: "Rename group" }));
    const input = screen.getByRole("textbox", { name: "Group name" });
    await user.clear(input);
    await user.type(input, "Abandoned{Escape}");
    expect(api.renameAssetGroup).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Mood/ })).toBeInTheDocument();
  });

  it("restores a recycled asset with its current revision", async () => {
    const recycled = {
      ...managed(asset("a", "Recycled", null)),
      state: "recycled" as const,
      revision: "9",
    };
    vi.mocked(library.listLibraryAssets).mockImplementation(async (query) => ({
      items: query.state === "recycled" ? [recycled] : [],
      total: 1,
      offset: 0,
      limit: 24,
    }));
    vi.mocked(library.restoreLibraryAsset).mockResolvedValue({
      id: "a",
      status: "restored",
      message: "恢复完成",
      logicalBytes: 0,
    });
    const user = userEvent.setup();
    renderLibrary();
    await user.click(screen.getByRole("button", { name: "回收站" }));
    await user.click(await screen.findByRole("button", { name: "恢复素材" }));
    expect(library.restoreLibraryAsset).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "a", revision: "9" }),
    );
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
  });
  it("does not roll back a newly loaded scope when an earlier group move fails", async () => {
    let rejectMove!: (reason: Error) => void;
    vi.mocked(api.assignAssetsToGroup).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectMove = reject;
      }),
    );
    const user = userEvent.setup();
    renderLibrary();
    await user.click(await screen.findByRole("button", { name: "Alpha" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Move to group" }),
      "__ungrouped__",
    );
    vi.mocked(library.listLibraryAssets).mockResolvedValueOnce({
      items: [managed(asset("public", "Public image", null))],
      total: 1,
      offset: 0,
      limit: 24,
    });
    await user.click(screen.getByRole("button", { name: "公共素材" }));
    await screen.findByRole("button", { name: "Public image" });
    await act(async () => {
      rejectMove(new Error("move rejected"));
    });
    expect(screen.getByRole("button", { name: "Public image" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Alpha" })).not.toBeInTheDocument();
  });

  it("submits group creation only once when Enter is repeated before the response", async () => {
    let resolveCreate!: (value: CanvasAssetGroupSummary) => void;
    vi.mocked(api.createAssetGroup).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole("button", { name: "Alpha" });
    await user.click(screen.getByRole("button", { name: "New group" }));
    const input = screen.getByRole("textbox", { name: "Group name" });
    await user.type(input, "Shots");
    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
      fireEvent.keyDown(input, { key: "Enter" });
    });
    const calls = vi.mocked(api.createAssetGroup).mock.calls.length;
    await act(async () => {
      resolveCreate(group("g2", "Shots", 0));
    });
    expect(calls).toBe(1);
  });
  it("filters the library by group and by ungrouped assets", async () => {
    const user = userEvent.setup();
    renderLibrary();

    expect(await screen.findByRole("button", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Beta" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Mood/ }));
    expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Beta" })).toBeNull();

    await user.click(screen.getByRole("button", { name: /Ungrouped/ }));
    expect(screen.queryByRole("button", { name: "Alpha" })).toBeNull();
    expect(screen.getByRole("button", { name: "Beta" })).toBeInTheDocument();
  });

  it("creates a named group from the navigation rail", async () => {
    const user = userEvent.setup();
    const created = group("g2", "Shots", 0);
    vi.mocked(api.createAssetGroup).mockResolvedValue(created);
    renderLibrary();

    await screen.findByRole("button", { name: "Alpha" });
    await user.click(screen.getByRole("button", { name: "New group" }));
    vi.mocked(api.listAssetGroups).mockResolvedValue({ groups: [group("g1", "Mood", 1), created] });
    await user.type(screen.getByRole("textbox", { name: "Group name" }), "Shots{Enter}");

    await waitFor(() => expect(api.createAssetGroup).toHaveBeenCalledWith("Shots"));
    expect(screen.getByRole("button", { name: /Shots/ })).toBeInTheDocument();
  });

  it("moves a multi-selection with one bulk request", async () => {
    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByRole("button", { name: "Alpha" }));
    await user.click(screen.getByRole("button", { name: "Beta" }));
    vi.mocked(api.listAssets).mockResolvedValue({
      assets: [asset("a", "Alpha", "g1"), asset("b", "Beta", "g1")],
    });
    await user.selectOptions(screen.getByRole("combobox", { name: "Move to group" }), "g1");

    await waitFor(() => expect(api.assignAssetsToGroup).toHaveBeenCalledWith(["a", "b"], "g1"));

    await user.click(screen.getByRole("button", { name: /Mood/ }));
    expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Beta" })).toBeInTheDocument();
  });

  it("renames a group once when Enter commits the inline field", async () => {
    const user = userEvent.setup();
    vi.mocked(api.renameAssetGroup).mockResolvedValue(group("g1", "Palette", 1));
    renderLibrary();

    await screen.findByRole("button", { name: "Alpha" });
    await user.click(screen.getByRole("button", { name: "Rename group" }));
    const input = screen.getByRole("textbox", { name: "Group name" });
    await user.clear(input);
    await user.type(input, "Palette{Enter}");

    await waitFor(() =>
      expect(api.renameAssetGroup).toHaveBeenCalledExactlyOnceWith("g1", "Palette"),
    );
    expect(screen.getByRole("button", { name: /Palette/ })).toBeInTheDocument();
  });

  it("deletes only the group and leaves its assets under Ungrouped", async () => {
    const user = userEvent.setup();
    renderLibrary();

    await screen.findByRole("button", { name: "Alpha" });
    await user.click(screen.getByRole("button", { name: "Delete group" }));
    vi.mocked(api.listAssetGroups).mockResolvedValue({ groups: [] });
    vi.mocked(api.listAssets).mockResolvedValue({
      assets: [asset("a", "Alpha", null), asset("b", "Beta", null)],
    });
    await user.click(screen.getByText("confirm:Delete group"));

    await waitFor(() => expect(api.deleteAssetGroup).toHaveBeenCalledWith("g1"));
    expect(screen.queryByRole("button", { name: /Mood/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: /Ungrouped/ }));
    expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Beta" })).toBeInTheDocument();
  });
});

describe("AssetLibraryDialog selection mode", () => {
  it("does not partially insert a public selection when one reuse fails", async () => {
    vi.mocked(library.reusePublicAsset)
      .mockResolvedValueOnce(managed(asset("owned-a", "Alpha", null)))
      .mockRejectedValueOnce(new library.AssetApiError("第二项已下架", 409));
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<AssetLibraryDialog onOpenChange={onOpenChange} at={() => ({ x: 0, y: 0 })} />);
    await user.click(screen.getByRole("button", { name: "公共素材" }));
    await user.click(await screen.findByRole("button", { name: "Alpha" }));
    await user.click(screen.getByRole("button", { name: "Beta" }));
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "已成功复用的项目可在我的素材中找到",
    );
    expect(library.reusePublicAsset).toHaveBeenCalledTimes(2);
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(library.reusePublicAsset).toHaveBeenCalledTimes(2);
  });

  it("does not insert late private details after cancelling the dialog", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof library.getLibraryAsset>>) => void;
    vi.mocked(library.getLibraryAsset).mockReturnValueOnce(
      new Promise((value) => {
        resolve = value;
      }),
    );
    const user = userEvent.setup();
    renderLibrary();
    await user.click(await screen.findByRole("button", { name: "Alpha" }));
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await act(async () =>
      resolve({
        asset: managed(asset("a", "Alpha", "g1")),
        prompt: "original",
        sha256: null,
        references: [],
        origins: [],
        audit: [],
        referencesComplete: true,
      }),
    );
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
  });

  it("uses the supplied administrator source for public reads and owned reuse", async () => {
    const original = managed(asset("public", "Admin source", null));
    const owned = managed(asset("admin-copy", "Admin source", null));
    const source = {
      listAssets: vi.fn(),
      listAssetPage: vi
        .fn()
        .mockResolvedValue({ items: [original], total: 1, offset: 0, limit: 24 }),
      listAssetGroups: vi.fn().mockResolvedValue({ groups: [] }),
      reusePublicAsset: vi.fn().mockResolvedValue(owned),
      assetUrl: (url: string) => url,
    };
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <AssetLibraryDialog
        mode="select"
        source={source}
        onSelect={onSelect}
        onOpenChange={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "公共素材" }));
    await user.click(await screen.findByRole("button", { name: "Admin source" }));
    await user.click(screen.getByRole("button", { name: "Use this image" }));
    expect(source.reusePublicAsset).toHaveBeenCalledExactlyOnceWith("public", "1");
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "admin-copy" }));
    expect(library.listLibraryAssets).not.toHaveBeenCalled();
    expect(library.reusePublicAsset).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "回收站" })).not.toBeInTheDocument();
  });
  it("does not deliver a late public reuse result after the picker is unmounted", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    let resolve!: (value: AssetItem) => void;
    vi.mocked(library.reusePublicAsset).mockReturnValue(
      new Promise((value) => {
        resolve = value;
      }),
    );
    const view = render(
      <AssetLibraryDialog mode="select" onSelect={onSelect} onOpenChange={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "公共素材" }));
    await user.click(await screen.findByRole("button", { name: "Alpha" }));
    await user.click(screen.getByRole("button", { name: "Use this image" }));
    view.unmount();
    await act(async () => {
      resolve(managed(asset("owned-copy", "Alpha", null)));
    });
    expect(onSelect).not.toHaveBeenCalled();
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
  });

  it("does not apply a late response when cancelling without unmounting", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    let resolve!: (value: AssetItem) => void;
    vi.mocked(library.reusePublicAsset).mockReturnValue(
      new Promise((value) => {
        resolve = value;
      }),
    );
    render(<AssetLibraryDialog mode="select" onSelect={onSelect} onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("button", { name: "公共素材" }));
    await user.click(await screen.findByRole("button", { name: "Alpha" }));
    await user.click(screen.getByRole("button", { name: "Use this image" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => {
      resolve(managed(asset("owned-copy", "Alpha", null)));
    });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("clears the previous selection when a new filter fails to load", async () => {
    const user = userEvent.setup();
    render(<AssetLibraryDialog mode="select" onSelect={vi.fn()} onOpenChange={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Alpha" }));
    vi.mocked(library.listLibraryAssets).mockRejectedValue(new Error("当前筛选请求失败"));
    await user.type(screen.getByRole("textbox", { name: "搜索素材" }), "x");
    expect(await screen.findByRole("alert")).toHaveTextContent("当前筛选请求失败");
    expect(screen.queryByRole("button", { name: "Alpha" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use this image" })).toBeDisabled();
  });

  it("reuses a public image before supplying its owned ID to the current node", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    vi.mocked(library.reusePublicAsset).mockResolvedValue(
      managed(asset("owned-copy", "Alpha", null)),
    );
    render(<AssetLibraryDialog mode="select" onSelect={onSelect} onOpenChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "公共素材" }));
    await user.click(await screen.findByRole("button", { name: "Alpha" }));
    await user.click(screen.getByRole("button", { name: "Use this image" }));
    expect(library.reusePublicAsset).toHaveBeenCalledExactlyOnceWith("a", "1");
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "owned-copy" }));
    expect(api.deleteAsset).not.toHaveBeenCalled();
  });

  it("keeps the current node untouched when a public source has been withdrawn", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    vi.mocked(library.reusePublicAsset).mockRejectedValue(new Error("素材已下架"));
    render(<AssetLibraryDialog mode="select" onSelect={onSelect} onOpenChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "公共素材" }));
    await user.click(await screen.findByRole("button", { name: "Alpha" }));
    await user.click(screen.getByRole("button", { name: "Use this image" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("素材已下架");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("preselects the current image and confirms only one asset without adding canvas nodes", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <AssetLibraryDialog
        mode="select"
        selectedAssetUrl="/api/v1/canvas/assets/a"
        onSelect={onSelect}
        onOpenChange={onOpenChange}
      />,
    );

    expect(await screen.findByRole("button", { name: "Alpha" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Beta" }));
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Beta" })).toHaveAttribute("aria-pressed", "true");
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Use this image" }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "b", url: "/api/v1/canvas/assets/b", prompt: null }),
    );
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
  });

  it("allows group filtering but hides mutation controls and disables dragging", async () => {
    const user = userEvent.setup();
    render(<AssetLibraryDialog mode="select" onSelect={vi.fn()} onOpenChange={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Alpha" }));
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute("draggable", "false");
    for (const name of ["Delete", "New group", "Rename group", "Delete group"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "回收站" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Move to group" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Mood/ }));
    expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Beta" })).not.toBeInTheDocument();
    expect(api.assignAssetsToGroup).not.toHaveBeenCalled();
  });

  it("does not apply a draft selection when cancelled", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(<AssetLibraryDialog mode="select" onSelect={onSelect} onOpenChange={onOpenChange} />);

    await user.click(await screen.findByRole("button", { name: "Alpha" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("allows retry after a failed request and never selects videos", async () => {
    const user = userEvent.setup();
    vi.mocked(api.listAssets).mockRejectedValueOnce(new Error("Library unavailable"));
    render(<AssetLibraryDialog mode="select" onSelect={vi.fn()} onOpenChange={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Library unavailable");
    expect(screen.getByRole("button", { name: "Use this image" })).toBeDisabled();
    vi.mocked(api.listAssets).mockResolvedValueOnce({
      assets: [
        asset("a", "Alpha", "g1"),
        { ...asset("v", "Video", null), kind: "video", mediaType: "video/mp4" },
      ],
    });
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await user.click(await screen.findByRole("button", { name: "Alpha" }));
    expect(api.listAssets).toHaveBeenCalledWith("image");
    expect(screen.queryByRole("button", { name: "Video" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use this image" })).toBeEnabled();
  });

  it("keeps images usable if the optional group request fails", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    vi.mocked(api.listAssetGroups).mockRejectedValueOnce(new Error("Groups unavailable"));
    render(<AssetLibraryDialog mode="select" onSelect={onSelect} onOpenChange={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Beta" }));
    await user.click(screen.getByRole("button", { name: "Use this image" }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "b", url: "/api/v1/canvas/assets/b", prompt: null }),
    );
  });

  it("keeps the original multi-image canvas insertion behavior", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await user.click(await screen.findByRole("button", { name: "Alpha" }));
    await user.click(screen.getByRole("button", { name: "Beta" }));
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(useCanvasStore.getState().nodes.map((node) => node.data.assetUrl)).toEqual([
      "/api/v1/canvas/assets/a",
      "/api/v1/canvas/assets/b",
    ]);
    expect(useCanvasStore.getState().nodes.map((node) => node.data.prompt)).toEqual([
      "Alpha",
      "Beta",
    ]);
  });
});
