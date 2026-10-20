import { describe, expect, it, vi } from "vitest";
import { readKnowledgeFiles } from "./api";

/** 避免依赖 jsdom 的 File.arrayBuffer 实现，仍测试严格解码及读取前大小上限。 */
function file(name: string, bytes: number[], size = bytes.length): File {
  return {
    name,
    size,
    arrayBuffer: vi.fn(async () => new Uint8Array(bytes).buffer),
  } as unknown as File;
}

describe("knowledge file validation", () => {
  it("decodes UTF-8 and rejects invalid byte sequences", async () => {
    expect(await readKnowledgeFiles([file("text.txt", [97, 98])])).toEqual([
      { name: "text.txt", text: "ab" },
    ]);
    await expect(readKnowledgeFiles([file("bad.txt", [0xff, 0xfe])])).rejects.toThrow("UTF-8");
  });
  it("rejects oversized or unsupported files before reading", async () => {
    const large = file("large.txt", [], 65537);
    await expect(readKnowledgeFiles([large])).rejects.toThrow("64 KiB");
    expect(large.arrayBuffer).not.toHaveBeenCalled();
    await expect(readKnowledgeFiles([file("file.pdf", [97])])).rejects.toThrow("TXT／MD");
    await expect(readKnowledgeFiles([file("x.md", [97]), file("X.MD", [98])])).rejects.toThrow(
      "不重复",
    );
  });
});
