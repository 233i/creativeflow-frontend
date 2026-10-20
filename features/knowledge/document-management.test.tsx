import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CleanupDialog } from "./cleanup-dialog";
import { DocumentChangeDialog } from "./document-change-dialog";
import { DocumentsPanel } from "./documents-panel";
import { pilotQuotas, type KnowledgeVersion } from "./api";
import { versionName } from "./knowledge-ui";

const api = vi.hoisted(() => ({
  documents: vi.fn(),
  document: vi.fn(),
  chunks: vi.fn(),
  previewChanges: vi.fn(),
  changeDocuments: vi.fn(),
  cleanupPreview: vi.fn(),
  cleanup: vi.fn(),
  read: vi.fn(),
}));
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  knowledgeApi: api,
  readKnowledgeFiles: api.read,
}));
const version: KnowledgeVersion = {
  id: "v3",
  number: 3,
  status: "ready",
  error: null,
  documentCount: 2,
  chunkCount: 2,
  embeddedCount: 2,
  writtenCount: 2,
  reusedCount: 1,
  chunkSize: 800,
  overlap: 100,
  createdAt: "2026-09-12T00:00:00Z",
};
const document = { id: "doc1", name: "manual.md", byteCount: 50, chunkCount: 1 };
const chunk = {
  id: "chunk1",
  document: document.name,
  startLine: 1,
  endLine: 1,
  text: "合成文档正文",
};
beforeEach(() => {
  vi.resetAllMocks();
  api.documents.mockResolvedValue([
    document,
    { id: "doc2", name: "faq.txt", byteCount: 10, chunkCount: 1 },
  ]);
  api.document.mockResolvedValue({ name: document.name, text: "原合成资料" });
  api.chunks.mockResolvedValue([chunk]);
  api.read.mockResolvedValue([{ name: "new.md", text: "新增合成资料" }]);
  api.previewChanges.mockResolvedValue({ digest: "confirmed", documentCount: 3, chunks: [chunk] });
  api.changeDocuments.mockResolvedValue({ ...version, id: "v4", number: 4, status: "queued" });
  api.cleanupPreview.mockResolvedValue({
    allowed: true,
    reason: null,
    referenceCount: 0,
    reservedBytes: 1048576,
  });
  api.cleanup.mockResolvedValue(undefined);
});

describe("immutable document management", () => {
  it("loads metadata only and reads the selected document on demand", async () => {
    const user = userEvent.setup();
    render(
      <DocumentsPanel
        libraryId="library"
        versionId="v3"
        activeVersion="v3"
        versions={[version]}
        onVersionChange={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    await screen.findByText(document.name);
    expect(api.chunks).not.toHaveBeenCalled();
    expect(api.document).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "更新 manual.md" }));
    expect(await screen.findByDisplayValue("原合成资料")).toBeInTheDocument();
    expect(api.document).toHaveBeenCalledWith("library", "v3", "doc1");
    expect(api.changeDocuments).not.toHaveBeenCalled();
  });
  it("previews additions against the fixed source and submits only after confirmation", async () => {
    const user = userEvent.setup();
    const changed = vi.fn(async () => {});
    render(
      <DocumentChangeDialog
        libraryId="library"
        version={version}
        action="add"
        quotas={pilotQuotas}
        onClose={vi.fn()}
        onChanged={changed}
      />,
    );
    await user.upload(screen.getByLabelText("新增文档文件"), new File(["new"], "new.md"));
    await user.click(screen.getByRole("button", { name: "预览新版本" }));
    await screen.findByText(/变更后：3 份文档/);
    expect(api.changeDocuments).not.toHaveBeenCalled();
    await user.dblClick(screen.getByRole("button", { name: "确认变更并排队" }));
    expect(api.changeDocuments).toHaveBeenCalledTimes(1);
    expect(api.changeDocuments).toHaveBeenCalledWith("library", {
      sourceVersionId: "v3",
      changes: [{ action: "add", name: "new.md", text: "新增合成资料" }],
      chunkSize: 800,
      overlap: 100,
      previewDigest: "confirmed",
    });
    await screen.findByText("文档变更已提交");
    expect(changed).toHaveBeenCalledTimes(1);
  });
  it("updates only the selected revision and invalidates preview when returning to edit", async () => {
    const user = userEvent.setup();
    render(
      <DocumentChangeDialog
        libraryId="library"
        version={version}
        action="replace"
        document={document}
        quotas={pilotQuotas}
        onClose={vi.fn()}
        onChanged={vi.fn(async () => {})}
      />,
    );
    const input = await screen.findByDisplayValue("原合成资料");
    await user.clear(input);
    await user.type(input, "新合成资料");
    await user.click(screen.getByRole("button", { name: "预览新版本" }));
    await screen.findByRole("button", { name: "确认变更并排队" });
    await user.click(screen.getByRole("button", { name: "返回修改" }));
    expect(screen.queryByRole("button", { name: "确认变更并排队" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "预览新版本" }));
    await waitFor(() => expect(api.previewChanges).toHaveBeenCalledTimes(2));
    expect(api.previewChanges.mock.calls[1][1].changes).toEqual([
      { action: "replace", name: "manual.md", documentId: "doc1", text: "新合成资料" },
    ]);
  });
  it("removing from a candidate has no mutation before preview and confirmation", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(
      <DocumentChangeDialog
        libraryId="library"
        version={version}
        action="remove"
        document={document}
        quotas={pilotQuotas}
        onClose={close}
        onChanged={vi.fn(async () => {})}
      />,
    );
    expect(screen.getByText(/旧版本中的正文与引用仍保留/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(close).toHaveBeenCalled();
    expect(api.changeDocuments).not.toHaveBeenCalled();
  });
  it("keeps the accepted receipt when refresh fails and never resubmits", async () => {
    const user = userEvent.setup();
    render(
      <DocumentChangeDialog
        libraryId="library"
        version={version}
        action="remove"
        document={document}
        quotas={pilotQuotas}
        onClose={vi.fn()}
        onChanged={vi.fn(async () => {
          throw new Error("刷新失败");
        })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "预览新版本" }));
    await user.click(await screen.findByRole("button", { name: "确认变更并排队" }));
    await screen.findByText("文档变更已提交");
    expect(screen.getByRole("alert")).toHaveTextContent("刷新失败");
    expect(screen.queryByRole("button", { name: "确认变更并排队" })).not.toBeInTheDocument();
    expect(api.changeDocuments).toHaveBeenCalledTimes(1);
  });
  it("uses stable version numbers after older versions have been cleaned", () => {
    expect(versionName([version], "v3")).toBe("V3");
  });
});

describe("explicit safe cleanup", () => {
  it("cannot clean a referenced version", async () => {
    api.cleanupPreview.mockResolvedValue({
      allowed: false,
      reason: "发布版本仍在引用",
      referenceCount: 2,
      reservedBytes: 100,
    });
    render(
      <CleanupDialog
        libraryId="library"
        versionId="v3"
        onClose={vi.fn()}
        onChanged={vi.fn(async () => {})}
      />,
    );
    await screen.findByText("发布版本仍在引用");
    expect(screen.getByRole("button", { name: "确认清理此版本" })).toBeDisabled();
    expect(api.cleanup).not.toHaveBeenCalled();
  });
  it("requires a reason, confirms once, and preserves the receipt on refresh failure", async () => {
    const user = userEvent.setup();
    render(
      <CleanupDialog
        libraryId="library"
        versionId="v3"
        onClose={vi.fn()}
        onChanged={vi.fn(async () => {
          throw new Error("刷新失败");
        })}
      />,
    );
    await screen.findByLabelText("清理原因");
    expect(screen.getByRole("button", { name: "确认清理此版本" })).toBeDisabled();
    await user.type(screen.getByLabelText("清理原因"), "合成测试版本已无引用");
    await user.dblClick(screen.getByRole("button", { name: "确认清理此版本" }));
    await screen.findByText("清理任务已提交");
    expect(api.cleanup).toHaveBeenCalledTimes(1);
    expect(api.cleanup).toHaveBeenCalledWith("library", "v3", "合成测试版本已无引用");
  });
});
