import { afterEach, expect, it, vi } from "vitest";
import { useCanvasStore, type CanvasNode } from "./store";
import { generateText } from "./text-generation";

vi.mock("@/features/ai/store", () => ({
  useAiStore: { getState: () => ({ providers: [], slots: { chat: {} } }) },
  resolveSlot: () => ({ provider: { id: "provider-1" }, model: { modelKey: "chat-1" } }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  useCanvasStore.getState().reset();
});

it("sends canvas context without changing text generation inputs or results", async () => {
  const node: CanvasNode = {
    id: "text-1",
    type: "text",
    position: { x: 0, y: 0 },
    data: { kind: "text", text: "原始提示词" },
  };
  useCanvasStore.getState().load({ nodes: [node], edges: [] }, "canvas-1");
  // 导入图快照仍属于当前画布，不应清除请求归属。
  useCanvasStore.getState().load({ nodes: [node], edges: [] });
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ text: "  生成内容  " })));
  vi.stubGlobal("fetch", fetchMock);
  const outcome = await generateText(node.id, "rewrite", [node], []);
  expect(outcome).toEqual({ ok: true, text: "生成内容" });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
    canvasId: "canvas-1",
    nodeId: "text-1",
    prompt: "原始提示词",
    modelKey: "chat-1",
    temperature: 0.8,
  });
});
