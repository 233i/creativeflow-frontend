import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChunkList, KnowledgeImportPanel } from "./import-panel";
import { KnowledgePanel } from "./knowledge-panel";
import { KnowledgeDetailPanel } from "./knowledge-detail";
import { KnowledgeSearchPanel } from "./search-panel";
import { CreateLibraryDialog } from "./create-library-dialog";
import { DocumentsPanel } from "./documents-panel";
import { VersionsPanel } from "./versions-panel";
import { groupDocuments } from "./knowledge-ui";
import type { KnowledgeVersion } from "./api";

const api = vi.hoisted(() => ({
  capabilities: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
  chunks: vi.fn(),
  documents: vi.fn(),
  create: vi.fn(),
  preview: vi.fn(),
  import: vi.fn(),
  read: vi.fn(),
  search: vi.fn(),
  activate: vi.fn(),
  recover: vi.fn(),
  enabled: vi.fn(),
}));
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  knowledgeApi: api,
  readKnowledgeFiles: api.read,
}));
vi.mock("@/features/ai/store", () => ({
  useAiStore: (selector: (state: { providers: [] }) => unknown) => selector({ providers: [] }),
}));
const chunk = {
  id: "chunk",
  document: "guide.md",
  startLine: 1,
  endLine: 2,
  text: "<script>alert(1)</script>\n合成手册",
};
const library = {
  id: "library",
  name: "产品手册",
  description: "合成测试",
  modelId: "model",
  enabled: true,
  activeVersion: "v1",
};
const version: KnowledgeVersion = {
  id: "v1",
  status: "ready",
  error: null,
  documentCount: 1,
  chunkCount: 1,
  embeddedCount: 1,
  createdAt: "2026-09-12T08:00:00Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  api.read.mockResolvedValue([{ name: "guide.md", text: "合成手册" }]);
  api.preview.mockResolvedValue({ digest: "digest", documentCount: 1, chunks: [chunk] });
  api.import.mockResolvedValue({ ...version, id: "queued", status: "queued" });
  api.capabilities.mockResolvedValue({ enabled: true, indexAvailable: true });
  api.list.mockResolvedValue([library]);
  api.detail.mockResolvedValue({ library, versions: [version] });
  api.chunks.mockResolvedValue([chunk]);
  api.documents.mockResolvedValue([{ id: "doc1", name: "guide.md", byteCount: 60, chunkCount: 1 }]);
  api.search.mockResolvedValue({ versionId: "v1", hits: [{ chunk, score: 0.8 }] });
});

async function previewImport(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(
    screen.getByLabelText("选择文档"),
    new File(["合成手册"], "guide.md", { type: "text/markdown" }),
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "预览分段" })).toBeEnabled());
  await user.click(screen.getByRole("button", { name: "预览分段" }));
  await screen.findByText(/1 份文档 · 1 个片段/);
}

describe("knowledge import safety", () => {
  it("requires preview and a separate confirmation before queuing the confirmed digest", async () => {
    const user = userEvent.setup();
    const onImported = vi.fn().mockResolvedValue(undefined);
    render(
      <KnowledgeImportPanel
        libraryId="library"
        indexAvailable
        onImported={onImported}
        onClose={vi.fn()}
      />,
    );
    await previewImport(user);
    expect(api.import).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /下一步：确认入库/ }));
    expect(screen.getByText(/可能产生模型调用费用/)).toBeInTheDocument();
    expect(api.import).not.toHaveBeenCalled();
    await user.dblClick(screen.getByRole("button", { name: "确认并排队入库" }));
    await waitFor(() => expect(onImported).toHaveBeenCalledOnce());
    expect(api.import).toHaveBeenCalledExactlyOnceWith(
      "library",
      expect.objectContaining({ previewDigest: "digest", chunkSize: 800, overlap: 100 }),
    );
    expect(screen.getByRole("button", { name: "查看任务" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "确认并排队入库" })).not.toBeInTheDocument();
  });

  it("invalidates preview when returning to edit and requires another preview", async () => {
    const user = userEvent.setup();
    render(
      <KnowledgeImportPanel
        libraryId="library"
        indexAvailable
        onImported={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await previewImport(user);
    await user.click(screen.getByRole("button", { name: "上一步" }));
    await user.clear(screen.getByLabelText("分段长度"));
    expect(screen.queryByRole("button", { name: /确认入库/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "预览分段" })).toBeDisabled();
    await user.type(screen.getByLabelText("分段长度"), "600");
    await user.click(screen.getByRole("button", { name: "预览分段" }));
    await screen.findByText(/1 份文档 · 1 个片段/);
    expect(api.preview).toHaveBeenLastCalledWith(expect.objectContaining({ chunkSize: 600 }));
    expect(api.import).not.toHaveBeenCalled();
  });

  it("does not permit import without configured storage", async () => {
    const user = userEvent.setup();
    render(
      <KnowledgeImportPanel
        libraryId="library"
        indexAvailable={false}
        onImported={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await previewImport(user);
    await user.click(screen.getByRole("button", { name: /下一步：确认入库/ }));
    expect(screen.getByRole("button", { name: "确认并排队入库" })).toBeDisabled();
    expect(api.import).not.toHaveBeenCalled();
  });

  it("keeps the success receipt when refreshing the list fails, preventing another import", async () => {
    const user = userEvent.setup();
    render(
      <KnowledgeImportPanel
        libraryId="library"
        indexAvailable
        onImported={vi.fn().mockRejectedValue(new Error("刷新失败"))}
        onClose={vi.fn()}
      />,
    );
    await previewImport(user);
    await user.click(screen.getByRole("button", { name: /下一步：确认入库/ }));
    await user.click(screen.getByRole("button", { name: "确认并排队入库" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("刷新失败");
    expect(screen.getByRole("button", { name: "查看任务" })).toBeInTheDocument();
    expect(api.import).toHaveBeenCalledOnce();
  });

  it("removes selected documents and rejects invalid overlap before preview", async () => {
    const user = userEvent.setup();
    render(
      <KnowledgeImportPanel
        libraryId="library"
        indexAvailable
        onImported={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await user.upload(screen.getByLabelText("选择文档"), new File(["text"], "guide.md"));
    await user.clear(screen.getByLabelText("重叠字符"));
    await user.type(screen.getByLabelText("重叠字符"), "400");
    expect(screen.getByRole("button", { name: "预览分段" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "移除 guide.md" }));
    expect(screen.queryByText("guide.md")).not.toBeInTheDocument();
    expect(api.preview).not.toHaveBeenCalled();
  });

  it("renders document HTML as inert text", () => {
    const { container } = render(<ChunkList chunks={[chunk]} />);
    expect(screen.getByText(/<script>alert/)).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });
});

describe("knowledge management navigation", () => {
  it("does not load resources when the feature is disabled", async () => {
    api.capabilities.mockResolvedValue({ enabled: false, indexAvailable: false });
    render(<KnowledgePanel />);
    expect(await screen.findByText("知识库功能未启用")).toBeInTheDocument();
    expect(api.list).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "新建知识库" })).not.toBeInTheDocument();
  });

  it("filters the list without fetching details or calling models", async () => {
    const user = userEvent.setup();
    render(<KnowledgePanel />);
    await screen.findByRole("navigation", { name: "知识库列表" });
    expect(screen.queryByLabelText(/知识库名称/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("搜索知识库"), "不存在");
    expect(screen.getByText("没有匹配的知识库")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "清空筛选" }));
    expect(screen.getByText("产品手册")).toBeInTheDocument();
    expect(api.detail).not.toHaveBeenCalled();
    expect(api.search).not.toHaveBeenCalled();
  });

  it("opens details, switches tabs, refreshes and returns without invoking a model", async () => {
    const user = userEvent.setup();
    render(<KnowledgePanel />);
    await user.click(await screen.findByRole("button", { name: /产品手册/ }));
    await screen.findByRole("tab", { name: "文档" });
    await user.click(screen.getByRole("tab", { name: "索引版本" }));
    expect(await screen.findByText("当前使用")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "检索测试" }));
    expect(screen.getByRole("button", { name: "发送检索测试" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "刷新状态" }));
    await user.click(screen.getByRole("button", { name: "全部知识库" }));
    expect(await screen.findByRole("navigation", { name: "知识库列表" })).toBeInTheDocument();
    expect(api.search).not.toHaveBeenCalled();
    expect(api.import).not.toHaveBeenCalled();
    expect(api.activate).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation before disabling the library", async () => {
    const user = userEvent.setup();
    render(
      <KnowledgeDetailPanel
        id="library"
        indexAvailable
        modelLabel="向量模型"
        onChanged={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    await user.click(await screen.findByRole("button", { name: "知识库设置" }));
    expect(api.enabled).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "确认停用知识库" }));
    await waitFor(() => expect(api.enabled).toHaveBeenCalledExactlyOnceWith("library", false));
  });

  it("does not read or show chunks of a disabled library", async () => {
    api.detail.mockResolvedValue({ library: { ...library, enabled: false }, versions: [version] });
    render(
      <KnowledgeDetailPanel
        id="library"
        indexAvailable
        modelLabel="向量模型"
        onChanged={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    await screen.findByRole("heading", { name: "知识库已停用" });
    expect(api.chunks).not.toHaveBeenCalled();
    expect(screen.queryByText(/<script>alert/)).not.toBeInTheDocument();
  });

  it("creates only after required fields, and creation itself does not invoke embedding", async () => {
    const user = userEvent.setup();
    const created = vi.fn();
    api.create.mockResolvedValue(library);
    render(
      <CreateLibraryDialog
        models={[{ id: "model", label: "本地向量模型" }]}
        onClose={vi.fn()}
        onCreated={created}
      />,
    );
    expect(screen.getByRole("button", { name: "创建知识库" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: /知识库名称/ }), "产品手册");
    await user.selectOptions(screen.getByRole("combobox"), "model");
    await user.click(screen.getByRole("button", { name: "创建知识库" }));
    await waitFor(() => expect(created).toHaveBeenCalledWith(library));
    expect(api.create).toHaveBeenCalledExactlyOnceWith({
      name: "产品手册",
      modelId: "model",
      description: "",
    });
    expect(api.import).not.toHaveBeenCalled();
  });
});

describe("sources, versions and retrieval", () => {
  it("groups source chunks and previews only the selected document", async () => {
    const user = userEvent.setup();
    api.chunks.mockResolvedValue([chunk, { ...chunk, id: "two" }]);
    api.documents.mockResolvedValue([
      { id: "doc1", name: "guide.md", byteCount: 60, chunkCount: 2 },
      { id: "doc2", name: "other.txt", byteCount: 20, chunkCount: 1 },
    ]);
    expect(groupDocuments([chunk, { ...chunk, id: "two" }])[0].chunks).toHaveLength(2);
    render(
      <DocumentsPanel
        libraryId="library"
        versionId="v1"
        activeVersion="v1"
        versions={[version]}
        onVersionChange={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    await screen.findByText("other.txt");
    await user.type(screen.getByLabelText("搜索文档"), "guide");
    expect(screen.queryByText("other.txt")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "查看 guide.md 的分段" }));
    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findAllByText(/<script>alert/)).toHaveLength(2);
    expect(api.chunks).toHaveBeenCalledWith("library", "v1", "doc1", 0);
    expect(api.search).not.toHaveBeenCalled();
  });

  it("does not activate a ready candidate until confirmation", async () => {
    const user = userEvent.setup();
    const run = vi.fn(async (action: () => Promise<void>) => {
      await action();
      return true;
    });
    render(
      <VersionsPanel
        libraryId="library"
        versions={[version]}
        activeVersion={null}
        enabled
        busy={false}
        run={run}
        onViewDocuments={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "激活此版本" }));
    expect(api.activate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "确认激活" }));
    expect(api.activate).toHaveBeenCalledExactlyOnceWith("library", "v1");
  });

  it("explains possible duplicate cost before retrying unknown batches", async () => {
    const user = userEvent.setup();
    const run = vi.fn(async (action: () => Promise<void>) => {
      await action();
      return true;
    });
    render(
      <VersionsPanel
        libraryId="library"
        versions={[{ ...version, status: "unknown" }]}
        activeVersion={null}
        enabled
        busy={false}
        run={run}
        onViewDocuments={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "核对并恢复" }));
    expect(screen.getByText("可能再次计费")).toBeInTheDocument();
    expect(api.recover).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "确认再次调用未完成批次" }));
    expect(api.recover).toHaveBeenCalledExactlyOnceWith("library", "v1", "reembedUnknown");
  });

  it("distinguishes rewriting saved vectors from re-embedding", () => {
    render(
      <VersionsPanel
        libraryId="library"
        versions={[{ ...version, status: "failed" }]}
        activeVersion={null}
        enabled
        busy={false}
        run={vi.fn()}
        onViewDocuments={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "重写索引（不调用模型）" })).toBeInTheDocument();
  });

  it("keeps a failed activation confirmation open with a visible error", async () => {
    const user = userEvent.setup();
    const run = vi.fn().mockResolvedValue(false);
    const props = {
      libraryId: "library",
      versions: [version],
      activeVersion: null,
      enabled: true,
      busy: false,
      run,
      onViewDocuments: vi.fn(),
    };
    const { rerender } = render(<VersionsPanel {...props} />);
    await user.click(screen.getByRole("button", { name: "激活此版本" }));
    await user.click(screen.getByRole("button", { name: "确认激活" }));
    rerender(<VersionsPanel {...props} error="索引校验失败" />);
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent("索引校验失败");
  });

  it("does not duplicate an in-flight retrieval when clicked twice", async () => {
    let resolve!: (value: unknown) => void;
    api.search.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const user = userEvent.setup();
    render(
      <KnowledgeSearchPanel
        libraryId="library"
        activeVersion="v1"
        activeName="V1"
        enabled
        indexAvailable
      />,
    );
    await user.type(screen.getByRole("textbox", { name: "检索问题" }), "保修多久");
    await user.dblClick(screen.getByRole("button", { name: "发送检索测试" }));
    expect(api.search).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "正在检索…" })).toBeDisabled();
    resolve({ versionId: "v1", hits: [] });
    expect(await screen.findByText("没有找到依据")).toBeInTheDocument();
  });

  it("submits one retrieval and clears results when the question changes", async () => {
    const user = userEvent.setup();
    render(
      <KnowledgeSearchPanel
        libraryId="library"
        activeVersion="v1"
        activeName="V1"
        enabled
        indexAvailable
      />,
    );
    await user.type(screen.getByRole("textbox", { name: /检索问题/ }), "保修多久");
    expect(api.search).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "发送检索测试" }));
    expect(await screen.findByText(/Cosine 0.8000/)).toBeInTheDocument();
    expect(api.search).toHaveBeenCalledExactlyOnceWith(
      "library",
      "保修多久",
      4,
      expect.objectContaining({ mode: "vector", topK: 4 }),
      undefined,
    );
    await user.type(screen.getByRole("textbox", { name: /检索问题/ }), "？");
    expect(screen.queryByText(/Cosine 0.8000/)).not.toBeInTheDocument();
  });

  it("refuses to render results for an unexpected active version", async () => {
    api.search.mockResolvedValue({ versionId: "other", hits: [{ chunk, score: 1 }] });
    const user = userEvent.setup();
    render(
      <KnowledgeSearchPanel
        libraryId="library"
        activeVersion="v1"
        activeName="V1"
        enabled
        indexAvailable
      />,
    );
    await user.type(screen.getByRole("textbox", { name: /检索问题/ }), "保修多久");
    await user.click(screen.getByRole("button", { name: "发送检索测试" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("激活版本已变化");
    expect(screen.queryByText(/<script>alert/)).not.toBeInTheDocument();
  });

  it("requires activation and valid integer Top K before retrieval", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <KnowledgeSearchPanel
        libraryId="library"
        activeVersion={null}
        activeName="未激活"
        enabled
        indexAvailable
      />,
    );
    await user.type(screen.getByRole("textbox", { name: /检索问题/ }), "保修多久");
    expect(screen.getByRole("button", { name: "发送检索测试" })).toBeDisabled();
    rerender(
      <KnowledgeSearchPanel
        libraryId="library"
        activeVersion="v1"
        activeName="V1"
        enabled
        indexAvailable
      />,
    );
    await user.clear(screen.getByLabelText("主命中数 TopK"));
    await user.type(screen.getByLabelText("主命中数 TopK"), "1.5");
    expect(screen.getByRole("button", { name: "发送检索测试" })).toBeDisabled();
    expect(api.search).not.toHaveBeenCalled();
  });
});
