import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { V2KnowledgeConfig } from "./knowledge-config";
import { V2OutputView } from "./output-view";
import { V2NodeConfig } from "./node-config";
import {
  canConnect,
  defaultData,
  nodeInputLabel,
  parseInputs,
  snapshotGraph,
  type WorkflowV2Graph,
  type WorkflowV2NodeData,
} from "./types";

const api = vi.hoisted(() => ({ catalog: vi.fn() }));
vi.mock("@/features/knowledge/access-api", () => ({ knowledgeAccessApi: api }));
beforeEach(() => {
  vi.resetAllMocks();
  api.catalog.mockResolvedValue([
    {
      id: "lib",
      name: "合成资料",
      description: "test",
      activeVersion: "v1",
      versions: [{ id: "v1", createdAt: "2026-09-12T01:00:00Z", indexSchema: "hybrid-v1" }],
    },
  ]);
});

describe("knowledge workflow UI", () => {
  it("distinguishes question and search semantics without rewriting saved port ids", () => {
    const retrieval = defaultData("knowledgeRetrieve"),
      answer = defaultData("knowledgeAnswer");
    expect(nodeInputLabel("knowledgeRetrieve", retrieval.fields[0])).toBe("检索词");
    expect(nodeInputLabel("knowledgeAnswer", answer.fields[0])).toBe("原始问题");
    expect(nodeInputLabel("knowledgeAnswer", answer.fields[1])).toBe("检索上下文");
    expect(retrieval.fields[0]).toEqual({ key: "question", type: "string", required: true });
    expect(answer.fields[0]).toEqual(retrieval.fields[0]);
    expect(nodeInputLabel("llm", { ...answer.fields[0], label: "自定义输入" })).toBe("自定义输入");
  });

  it("explains independent answer wiring in the config without mutating the graph", () => {
    const graph: WorkflowV2Graph = {
      schemaVersion: 1,
      edges: [],
      nodes: [
        {
          id: "answer",
          type: "knowledgeAnswer",
          data: defaultData("knowledgeAnswer"),
          position: { x: 0, y: 0 },
        },
      ],
    };
    const before = JSON.stringify(snapshotGraph(graph));
    const change = vi.fn();
    render(
      <V2NodeConfig
        node={graph.nodes[0]}
        graph={graph}
        onChange={change}
        onBind={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText(/原始问题用于回答，检索词用于找资料，两者可以不同/)).toBeVisible();
    expect(screen.getByLabelText("字段 1 名称")).toHaveValue("原始问题");
    expect(screen.getByLabelText("字段 2 名称")).toHaveValue("检索上下文");
    expect(screen.getByLabelText("字段 1 标识")).toHaveValue("question");
    expect(JSON.stringify(snapshotGraph(graph))).toBe(before);
    expect(change).not.toHaveBeenCalled();
  });

  it("shows the exact stored retrieval query as inert text in run outputs", () => {
    const query = '<img src=x onerror="alert(1)"> 检索词';
    const { container } = render(
      <V2OutputView fields={{ context: { question: query, hits: [], truncated: false } }} />,
    );
    expect(screen.getByText("检索词：")).toBeVisible();
    expect(screen.getByText(/<img src=x/)).toHaveTextContent(query);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("当前阈值下没有找到依据。")).toBeVisible();
  });

  it("uses nominal context and answer ports, not arbitrary input JSON", () => {
    const graph: WorkflowV2Graph = {
      schemaVersion: 1,
      edges: [],
      nodes: [
        {
          id: "start",
          type: "start",
          data: { fields: [{ key: "context", type: "object", required: true }] },
          position: { x: 0, y: 0 },
        },
        {
          id: "retrieve",
          type: "knowledgeRetrieve",
          data: defaultData("knowledgeRetrieve"),
          position: { x: 0, y: 0 },
        },
        {
          id: "answer",
          type: "knowledgeAnswer",
          data: defaultData("knowledgeAnswer"),
          position: { x: 0, y: 0 },
        },
      ],
    };
    expect(
      canConnect(graph, {
        source: "start",
        sourceHandle: "context",
        target: "answer",
        targetHandle: "context",
      }),
    ).toBe(false);
    expect(
      canConnect(graph, {
        source: "retrieve",
        sourceHandle: "context",
        target: "answer",
        targetHandle: "context",
      }),
    ).toBe(true);
    expect(() =>
      parseInputs([{ key: "context", type: "contextChunks", required: true }], { context: "{}" }),
    ).toThrow("知识证据不能通过外部输入伪造");
  });

  it("selects a fixed authorized version without invoking a model", async () => {
    const actions = userEvent.setup();
    const change = vi.fn();
    render(
      <V2KnowledgeConfig data={defaultData("knowledgeRetrieve")} admin={false} onChange={change} />,
    );
    await screen.findByRole("option", { name: "合成资料" });
    expect(api.catalog).toHaveBeenCalledExactlyOnceWith(false);
    expect(change).not.toHaveBeenCalled();
    await actions.selectOptions(screen.getByLabelText("检索知识库"), "lib");
    expect(change).toHaveBeenLastCalledWith(
      expect.objectContaining({ libraryId: "lib", versionId: "v1" }),
    );
  });

  it("marks a revoked resource unavailable without silently choosing another", async () => {
    const change = vi.fn();
    render(
      <V2KnowledgeConfig
        data={{ ...defaultData("knowledgeRetrieve"), libraryId: "gone", versionId: "old" }}
        admin
        onChange={change}
      />,
    );
    await waitFor(() => expect(api.catalog).toHaveBeenCalledWith(true));
    expect(screen.getByRole("option", { name: "原知识库不可用或已撤权" })).toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });

  it("renders citations as inert text with their original location", () => {
    const { container } = render(
      <V2OutputView
        fields={{
          answer: {
            text: "合成回答",
            grounded: true,
            citations: [
              {
                id: "chunk",
                document: "manual.md",
                startLine: 2,
                endLine: 4,
                text: '<img src=x onerror="alert(1)">',
                versionId: "version",
              },
            ],
          },
        }}
      />,
    );
    expect(screen.getByText("合成回答")).toBeInTheDocument();
    expect(screen.getByText(/manual.md · 第 2–4 行/)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
  });

  it("shows insufficient evidence and context truncation explicitly", () => {
    render(
      <V2OutputView
        fields={{
          answer: { text: "没有找到依据", grounded: false, citations: [] },
          context: { hits: [], truncated: true },
        }}
      />,
    );
    expect(screen.getByText("依据不足")).toBeInTheDocument();
    expect(screen.getByText(/该历史运行未记录具体限制原因/)).toBeInTheDocument();
  });

  it("edits the node chunk limit and retains it in a saved graph", async () => {
    const actions = userEvent.setup();
    const save = vi.fn();
    function Editor() {
      const [data, setData] = useState<WorkflowV2NodeData<"knowledgeRetrieve">>({
        ...defaultData("knowledgeRetrieve"),
        libraryId: "lib",
        versionId: "v1",
      });
      return (
        <>
          <V2KnowledgeConfig data={data} admin onChange={setData} />
          <button
            onClick={() =>
              save(
                snapshotGraph({
                  schemaVersion: 1,
                  edges: [],
                  nodes: [
                    { id: "retrieve", type: "knowledgeRetrieve", data, position: { x: 0, y: 0 } },
                  ],
                }),
              )
            }
          >
            保存测试图
          </button>
        </>
      );
    }
    render(<Editor />);
    await screen.findByRole("option", { name: "合成资料" });
    const input = screen.getByLabelText("最终交付片段数");
    expect(input).toHaveValue("8");
    await actions.clear(input);
    expect(screen.getByRole("alert")).toHaveTextContent("最终交付片段数必须是 1–32 的整数");
    await actions.type(input, "12");
    expect(input).toHaveValue("12");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await actions.click(screen.getByRole("button", { name: "保存测试图" }));
    const restored = JSON.parse(JSON.stringify(save.mock.calls[0][0])) as WorkflowV2Graph;
    expect(restored.nodes[0].data.maxContextChunks).toBe(12);
    expect(screen.getByLabelText("主命中数 TopK")).toHaveValue("4");
    expect(api.catalog).toHaveBeenCalledTimes(1);
  });

  it.each([0, -1, 1.5, 33])(
    "marks invalid chunk limit %s before submission",
    async (maxContextChunks) => {
      render(
        <V2KnowledgeConfig
          data={{
            ...defaultData("knowledgeRetrieve"),
            libraryId: "lib",
            versionId: "v1",
            maxContextChunks,
          }}
          admin
          onChange={vi.fn()}
        />,
      );
      await screen.findByRole("option", { name: "合成资料" });
      expect(screen.getByRole("alert")).toHaveTextContent("最终交付片段数必须是 1–32 的整数");
    },
  );

  it("displays the default for an existing node without mutating it", async () => {
    const data: WorkflowV2NodeData = { ...defaultData("knowledgeRetrieve") };
    delete data.maxContextChunks;
    const change = vi.fn();
    render(<V2KnowledgeConfig data={data} admin onChange={change} />);
    await screen.findByRole("option", { name: "合成资料" });
    expect(screen.getByLabelText("最终交付片段数")).toHaveValue("8");
    expect(change).not.toHaveBeenCalled();
  });

  it("explains when the final limit drops primary hits rather than neighbors", async () => {
    render(
      <V2KnowledgeConfig
        data={{
          ...defaultData("knowledgeRetrieve"),
          libraryId: "lib",
          versionId: "v1",
          topK: 12,
          maxContextChunks: 8,
        }}
        admin
        onChange={vi.fn()}
      />,
    );
    await screen.findByRole("option", { name: "合成资料" });
    expect(screen.getByText(/交付上限小于 TopK/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders all 32 full sources and reports count omissions precisely", () => {
    const hits = Array.from({ length: 32 }, (_, i) => ({
      id: `chunk-${i}`,
      document: `manual-${i}.md`,
      startLine: 1,
      endLine: 2,
      text: "合成正文".repeat(400),
    }));
    const { rerender, container } = render(
      <V2OutputView fields={{ context: { hits, truncated: false, maxContextChunks: 32 } }} />,
    );
    expect(screen.getByText("交付 32 个片段")).toBeInTheDocument();
    expect(container.querySelectorAll("details")).toHaveLength(32);
    expect(screen.queryByText(/省略|预算/)).not.toBeInTheDocument();
    rerender(
      <V2OutputView
        fields={{
          context: {
            hits: hits.slice(0, 8),
            truncated: true,
            maxContextChunks: 8,
            omittedCount: 24,
            truncationReason: "chunk_limit",
          },
        }}
      />,
    );
    expect(screen.getByText("已达 8 个片段上限，省略 24 个候选片段。")).toBeInTheDocument();
    rerender(
      <V2OutputView fields={{ answer: { text: "合成答案", grounded: true, citations: hits } }} />,
    );
    expect(screen.getByText("知识库回答 · 32 个来源")).toBeInTheDocument();
    expect(container.querySelectorAll("details")).toHaveLength(32);
  });
});
