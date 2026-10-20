import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@xyflow/react", () => ({
  NodeResizer: () => null,
  Handle: () => null,
  Position: { Left: "left", Right: "right" },
  useReactFlow: () => ({ getNodes: () => [], getEdges: () => [] }),
}));

vi.mock("@/components/providers/i18n-provider", () => ({
  useT: () => (key: string) => key,
}));

// 未配置对话模型，因此续写和改写操作不会出现在组件树中。
vi.mock("@/features/ai/store", () => ({
  useAiStore: (select: (state: unknown) => unknown) =>
    select({ providers: [], slots: { chat: null, fast: null } }),
  resolveSlot: () => null,
}));

const { useCanvasStore } = await import("@/features/canvas/store");
const { TextNode } = await import("@/features/canvas/nodes/text-node");

function storedText(id: string): string | undefined {
  const node = useCanvasStore.getState().nodes.find((candidate) => candidate.id === id);
  return (node?.data as { text?: string }).text;
}

/** React Flow 会向节点组件传入大量属性；此处只关心 `id` 和 `data`。 */
function nodeProps(text: string) {
  return {
    id: "t",
    data: { text },
    type: "text",
    selected: false,
    isConnectable: true,
    dragging: false,
    draggable: true,
    selectable: true,
    deletable: true,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  };
}

function renderNode(text = "") {
  useCanvasStore.getState().load({
    nodes: [{ id: "t", type: "text", position: { x: 0, y: 0 }, data: { text } }],
    edges: [],
  });

  const view = render(<TextNode {...nodeProps(text)} />);

  return { view, textarea: screen.getByRole("textbox") as HTMLTextAreaElement };
}

beforeEach(() => {
  useCanvasStore.getState().reset();
});

describe("TextNode composition input", () => {
  it("does not commit the intermediate letters of an IME composition", () => {
    // 回归测试：文本框曾直接从状态仓库读取值，React 会在组字过程中将该值重新应用到元素，
    // 从而破坏组字缓冲区；输入拼音时屏幕会显示拉丁字母，而不是正在组合的汉字。
    const { textarea } = renderNode();

    fireEvent.compositionStart(textarea);
    fireEvent.change(textarea, { target: { value: "ni" } });
    fireEvent.change(textarea, { target: { value: "nihao" } });

    // 用户能在屏幕上看到拼音，但此时尚未向文档提交任何内容。
    expect(textarea.value).toBe("nihao");
    expect(storedText("t")).toBe("");

    fireEvent.compositionEnd(textarea, { target: { value: "你好" } });

    expect(storedText("t")).toBe("你好");
  });

  it("keeps one composition to a single undo step", () => {
    const { textarea } = renderNode();
    const baseline = useCanvasStore.getState().past.length;

    fireEvent.compositionStart(textarea);
    fireEvent.change(textarea, { target: { value: "n" } });
    fireEvent.change(textarea, { target: { value: "nihao" } });
    fireEvent.compositionEnd(textarea, { target: { value: "你好" } });

    expect(useCanvasStore.getState().past.length).toBe(baseline + 1);
  });

  it("still commits ordinary typing as it happens", () => {
    const { textarea } = renderNode();

    fireEvent.change(textarea, { target: { value: "plain" } });

    expect(storedText("t")).toBe("plain");
  });

  it("picks up a value changed from outside the node", () => {
    // AI 改写、撤销或提示词库插入都会替用户写入文本。
    const { view, textarea } = renderNode("before");
    expect(textarea.value).toBe("before");

    view.rerender(<TextNode {...nodeProps("after")} />);

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("after");
  });
});
