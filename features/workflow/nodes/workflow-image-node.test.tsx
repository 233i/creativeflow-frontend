import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NodeProps } from "@xyflow/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UploadedAsset } from "@/features/ai/api";
import type { CanvasAssetSummary } from "@/features/canvas/api";
import type { WorkflowGraph } from "@/features/workflow/types";
import type { AssetItem } from "@/features/assets/api";
import { WorkflowEditorEnvironmentContext } from "@/features/workflow/editor-environment";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right" },
}));
const translate = (key: string) => key;
vi.mock("@/components/providers/i18n-provider", () => ({ useT: () => translate }));
vi.mock("@/features/ai/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/ai/api")>()),
  uploadAsset: vi.fn(),
}));
vi.mock("@/features/canvas/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/canvas/api")>()),
  listAssets: vi.fn(),
  listAssetGroups: vi.fn(),
}));

const { WorkflowImageNode } = await import("./workflow-nodes");
const { uploadAsset } = await import("@/features/ai/api");
const api = await import("@/features/canvas/api");
vi.mock("@/features/assets/api", async (original) => ({
  ...(await original<typeof import("@/features/assets/api")>()),
  listLibraryAssets: vi.fn(),
}));
const library = await import("@/features/assets/api");
const { useWorkflowStore } = await import("@/features/workflow/store");
const { useCanvasStore } = await import("@/features/canvas/store");

const libraryImage: CanvasAssetSummary = {
  id: "existing",
  url: "/api/v1/canvas/assets/existing",
  kind: "image",
  mediaType: "image/webp",
  prompt: "Existing image",
  byteSize: 128,
  createdAt: "2026-09-06T00:00:00Z",
  groupId: null,
};
const uploaded: UploadedAsset = {
  url: "/api/v1/canvas/assets/uploaded",
  mediaType: "image/png",
  assetId: "uploaded",
};
const item: AssetItem = {
  ...libraryImage,
  name: "Existing image",
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
  thumbnailUrl: libraryImage.url + "/thumbnail",
  canManage: true,
};

function graph(withImage = true): WorkflowGraph {
  return {
    nodes: [
      {
        id: "image",
        type: "image",
        position: { x: 10, y: 20 },
        width: 280,
        height: 260,
        data: {
          label: "Keep this metadata",
          ...(withImage ? { assetUrl: "/before.png", mediaType: "image/png" } : {}),
        },
      },
      { id: "generator", type: "imageGenerate", position: { x: 400, y: 20 }, data: { count: 1 } },
    ],
    edges: [
      {
        id: "keep-edge",
        source: "image",
        sourceHandle: "image",
        target: "generator",
        targetHandle: "image",
      },
    ],
    externalApi: {
      schemaVersion: 1,
      inputs: [
        {
          key: "reference",
          label: "Reference",
          description: "",
          required: true,
          type: "image",
          target: { nodeId: "image", field: "assetUrl" },
        },
      ],
      outputs: [],
    },
  };
}

/** 与 React Flow 一样从 store 取得更新后的节点数据。 */
function LiveImageNode() {
  const node = useWorkflowStore((state) =>
    state.nodes.find((candidate) => candidate.id === "image"),
  );
  return node ? (
    <WorkflowImageNode {...({ id: node.id, data: node.data, selected: false } as NodeProps)} />
  ) : null;
}

beforeEach(() => {
  vi.resetAllMocks();
  useWorkflowStore.getState().load(graph());
  useCanvasStore.getState().reset();
  vi.mocked(api.listAssets).mockResolvedValue({ assets: [libraryImage] });
  vi.mocked(library.listLibraryAssets).mockResolvedValue({
    items: [item],
    total: 1,
    offset: 0,
    limit: 24,
  });
  vi.mocked(api.listAssetGroups).mockResolvedValue({ groups: [] });
  vi.mocked(uploadAsset).mockResolvedValue(uploaded);
});

describe("workflow image input sources", () => {
  it.each([false, true])(
    "reuses a library image in the current node (previous image: %s)",
    async (withImage) => {
      const user = userEvent.setup();
      const original = graph(withImage);
      useWorkflowStore.getState().load(original);
      render(<LiveImageNode />);
      expect(screen.getByRole("button", { name: "workflow.localUpload" })).toBeEnabled();
      await user.click(screen.getByRole("button", { name: "workflow.chooseFromLibrary" }));
      await user.click(await screen.findByRole("button", { name: "Existing image" }));
      await user.click(screen.getByRole("button", { name: "canvas.assetUseImage" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByAltText("workflow.portImageInput")).toHaveAttribute(
        "src",
        libraryImage.url,
      );
      const state = useWorkflowStore.getState();
      expect(state.nodes).toHaveLength(2);
      expect(state.nodes[0]).toEqual({
        ...original.nodes[0],
        data: {
          ...original.nodes[0].data,
          assetUrl: libraryImage.url,
          mediaType: libraryImage.mediaType,
        },
      });
      expect(state.nodes[1]).toBe(original.nodes[1]);
      expect(state.edges).toBe(original.edges);
      expect(state.externalApi).toBe(original.externalApi);
      expect(state.revision).toBe(1);
      expect(useCanvasStore.getState().nodes).toHaveLength(0);
      expect(uploadAsset).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: "API · reference" })).not.toBeInTheDocument();
    },
  );

  it("uses admin assets and binding controls without changing canonical graph URLs", async () => {
    const user = userEvent.setup();
    const assets = {
      listAssets: vi.fn().mockResolvedValue({ assets: [libraryImage] }),
      listAssetPage: vi.fn().mockResolvedValue({ items: [item], total: 1, offset: 0, limit: 24 }),
      reusePublicAsset: vi.fn(),
      listAssetGroups: vi.fn().mockResolvedValue({ groups: [] }),
      uploadAsset: vi.fn().mockResolvedValue(uploaded),
      assetUrl: (url: string) => `/admin-preview?asset=${encodeURIComponent(url)}`,
    };
    const { container } = render(
      <WorkflowEditorEnvironmentContext.Provider value={{ canManageApi: true, assets }}>
        <LiveImageNode />
      </WorkflowEditorEnvironmentContext.Provider>,
    );
    await user.click(screen.getByRole("button", { name: "API · reference" }));
    expect(useWorkflowStore.getState().bindingTarget).toEqual(
      expect.objectContaining({ nodeId: "image" }),
    );
    await user.click(screen.getByRole("button", { name: "workflow.chooseFromLibrary" }));
    await user.click(await screen.findByRole("button", { name: "Existing image" }));
    await user.click(screen.getByRole("button", { name: "canvas.assetUseImage" }));
    expect(assets.listAssetPage).toHaveBeenCalledOnce();
    expect(api.listAssets).not.toHaveBeenCalled();
    expect(screen.getByAltText("workflow.portImageInput")).toHaveAttribute(
      "src",
      assets.assetUrl(libraryImage.url),
    );
    expect(useWorkflowStore.getState().nodes[0].data.assetUrl).toBe(libraryImage.url);
    const file = new File(["image"], "local.png", { type: "image/png" });
    await user.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, file);
    await waitFor(() => expect(assets.uploadAsset).toHaveBeenCalledWith(file));
    expect(uploadAsset).not.toHaveBeenCalled();
    expect(useWorkflowStore.getState().nodes[0].data.assetUrl).toBe(uploaded.url);
  });

  it.each(["cancel", "escape"])("leaves the current node unchanged after %s", async (method) => {
    const user = userEvent.setup();
    const original = useWorkflowStore.getState();
    render(<LiveImageNode />);
    await user.click(screen.getByRole("button", { name: "workflow.chooseFromLibrary" }));
    await user.click(await screen.findByRole("button", { name: "Existing image" }));
    if (method === "cancel")
      await user.click(screen.getByRole("button", { name: "common.cancel" }));
    else await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useWorkflowStore.getState()).toBe(original);
    expect(uploadAsset).not.toHaveBeenCalled();
    expect(screen.getByAltText("workflow.portImageInput")).toHaveAttribute("src", "/before.png");
  });

  it("does not propagate picker shortcuts to the canvas, while Escape still closes it", async () => {
    const user = userEvent.setup();
    const backgroundKeyDown = vi.fn();
    render(
      <div role="presentation" onKeyDown={backgroundKeyDown}>
        <LiveImageNode />
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "workflow.chooseFromLibrary" }));
    await screen.findByRole("button", { name: "Existing image" });
    await user.keyboard("{Delete}{Backspace}{ArrowDown}");
    expect(backgroundKeyDown).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useWorkflowStore.getState().edges).toEqual(graph().edges);
  });

  it("preserves local uploads and permits selecting the same file again", async () => {
    const user = userEvent.setup();
    const { container } = render(<LiveImageNode />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["image"], "local.png", { type: "image/png" });
    await user.upload(input, file);
    await waitFor(() =>
      expect(screen.getByAltText("workflow.portImageInput")).toHaveAttribute("src", uploaded.url),
    );
    expect(input.value).toBe("");
    await user.upload(input, file);
    expect(uploadAsset).toHaveBeenCalledTimes(2);
    expect(uploadAsset).toHaveBeenCalledWith(file);
    expect(useWorkflowStore.getState().edges).toEqual(graph().edges);
  });

  it("blocks conflicting source actions during upload and keeps the old image on failure", async () => {
    let rejectUpload!: (error: Error) => void;
    vi.mocked(uploadAsset).mockReturnValue(
      new Promise((_, reject) => {
        rejectUpload = reject;
      }),
    );
    const { container } = render(<LiveImageNode />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["image"], "local.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.change(input, { target: { files: [file] } });
    expect(uploadAsset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "workflow.chooseFromLibrary" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "workflow.uploading" })).toBeDisabled();
    await act(async () => rejectUpload(new Error("Upload failed")));
    expect(screen.getByRole("alert")).toHaveTextContent("Upload failed");
    expect(screen.getByAltText("workflow.portImageInput")).toHaveAttribute("src", "/before.png");
    expect(screen.getByRole("button", { name: "workflow.chooseFromLibrary" })).toBeEnabled();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "workflow.chooseFromLibrary" }));
    await user.click(await screen.findByRole("button", { name: "Existing image" }));
    await user.click(screen.getByRole("button", { name: "canvas.assetUseImage" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(uploadAsset).toHaveBeenCalledTimes(1);
  });

  it("does not apply a late upload after leaving the workflow", async () => {
    let finishUpload!: (asset: UploadedAsset) => void;
    vi.mocked(uploadAsset).mockReturnValue(
      new Promise((resolve) => {
        finishUpload = resolve;
      }),
    );
    const { container, unmount } = render(<LiveImageNode />);
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(["image"], "local.png", { type: "image/png" })] },
    });
    unmount();
    useWorkflowStore.getState().load(graph());
    const nextWorkflow = useWorkflowStore.getState();
    await act(async () => finishUpload(uploaded));
    expect(useWorkflowStore.getState()).toBe(nextWorkflow);
  });
});
