import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RetrievalEvaluationPanel } from "./retrieval-evaluation";
import { RetrievalTraceView } from "./retrieval-trace";
import { KnowledgeSearchPanel } from "./search-panel";
import { defaultRetrievalSettings, retrievalError, type RetrievalTrace } from "./retrieval-types";
import type { EvaluationResult, KnowledgeSearch } from "./api";
const api = vi.hoisted(() => ({ search: vi.fn(), evaluate: vi.fn() }));
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  knowledgeApi: api,
}));
vi.mock("@/features/ai/store", () => ({
  useAiStore: (select: (value: { providers: [] }) => unknown) => select({ providers: [] }),
}));
const trace: RetrievalTrace = {
  mode: "hybrid",
  query: "customer_code",
  originalQuestion: "查询 `customer_code`",
  denseCount: 2,
  keywordCount: 3,
  exactCount: 1,
  fusedCount: 4,
  rerankedCount: 4,
  deliveredCount: 1,
  rerankStatus: "completed",
  rerankError: null,
  rerankModelId: "rerank-1",
  rerankConfigurationVersion: "config-v1",
  rerankTokens: 20,
  embeddingMilliseconds: 10,
  recallMilliseconds: 20,
  rerankMilliseconds: 30,
  totalMilliseconds: 60,
  candidates: [
    {
      id: "chunk-1",
      denseRank: 2,
      keywordRank: 1,
      fusionRank: 1,
      rerankRank: 1,
      denseScore: 0.8,
      keywordScore: 5.2,
      fusionScore: 0.048,
      rerankScore: 0.95,
      exactMatched: true,
      selected: true,
      reason: "selected",
    },
  ],
};
const result: KnowledgeSearch = {
  versionId: "v1",
  trace,
  hits: [
    {
      chunk: {
        id: "chunk-1",
        document: "guide.md",
        startLine: 1,
        endLine: 2,
        text: "字段 customer_code",
      },
      score: 0.95,
      scoreType: "rerank",
      role: "primary",
    },
  ],
};
const evaluated: EvaluationResult = {
  versionId: "v1",
  metrics: [
    { strategy: "hybrid", recall: 1, mrr: 1, ndcg: 1, elapsedMilliseconds: 20, results: [result] },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  api.search.mockResolvedValue(result);
  api.evaluate.mockResolvedValue(evaluated);
});
describe("shared hybrid retrieval controls", () => {
  it("validates counts and score scales independently", () => {
    expect(retrievalError(defaultRetrievalSettings)).toBeNull();
    expect(retrievalError({ ...defaultRetrievalSettings, topK: 3.5 })).toContain("整数");
    expect(retrievalError({ ...defaultRetrievalSettings, minRerankScore: 0.5 })).toContain(
      "已选择模型",
    );
    expect(retrievalError({ ...defaultRetrievalSettings, minVectorScore: 5 })).toContain("-1–1");
    expect(retrievalError(defaultRetrievalSettings, false)).toContain("重建混合索引");
    expect(retrievalError({ ...defaultRetrievalSettings, maxContextChunks: 2 })).toBeNull();
  });
  it("sends hybrid settings only on explicit action and invalidates receipts after editing", async () => {
    const user = userEvent.setup();
    render(
      <KnowledgeSearchPanel
        libraryId="library"
        activeVersion="v1"
        activeName="v1"
        enabled
        indexAvailable
        indexSchema="hybrid-v1"
      />,
    );
    await user.type(screen.getByRole("textbox", { name: "检索问题" }), "customer_code");
    expect(api.search).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "发送检索测试" }));
    expect(api.search).toHaveBeenCalledWith(
      "library",
      "customer_code",
      4,
      expect.objectContaining({ mode: "hybrid", keywordCandidates: 32 }),
      undefined,
    );
    expect(await screen.findByRole("region", { name: "检索执行诊断" })).toHaveTextContent("BM25");
    await user.type(screen.getByRole("textbox", { name: "检索问题" }), "2");
    expect(screen.queryByRole("region", { name: "检索执行诊断" })).not.toBeInTheDocument();
    expect(api.search).toHaveBeenCalledOnce();
  });
  it("shows raw ranks, bounded score scales and explicit fallback without interpreting probabilities", () => {
    render(
      <RetrievalTraceView
        trace={{ ...trace, rerankStatus: "fallback", rerankError: "timeout_unknown; 未自动重试" }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("未自动重试");
    expect(screen.getByText(/重排序 已降级/)).toBeInTheDocument();
    expect(screen.getByText("#1 / 5.2000")).toBeInTheDocument();
    expect(screen.getByText("已交付")).toBeInTheDocument();
    expect(screen.getByText(/config-v1/)).toHaveTextContent("token 20");
  });
});
describe("manual retrieval evaluation", () => {
  async function prepare(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByText("对照评测 · 向量 / 混合 / 混合＋重排序"));
    await user.click(screen.getByRole("checkbox", { name: /guide.md/ }));
    await user.click(screen.getByRole("button", { name: "将当前问题与相关片段加入题集" }));
  }
  it("uses manually marked chunks and prevents duplicated paid evaluations", async () => {
    const user = userEvent.setup();
    const onBusyChange = vi.fn();
    let finish!: (value: EvaluationResult) => void;
    api.evaluate.mockImplementation(
      () =>
        new Promise<EvaluationResult>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <RetrievalEvaluationPanel
        libraryId="library"
        versionId="v1"
        query="customer_code"
        result={result}
        settings={defaultRetrievalSettings}
        searchBusy={false}
        onBusyChange={onBusyChange}
      />,
    );
    expect(api.evaluate).not.toHaveBeenCalled();
    await prepare(user);
    await user.dblClick(screen.getByRole("button", { name: "确认运行 1 题对照评测" }));
    expect(api.evaluate).toHaveBeenCalledExactlyOnceWith(
      "library",
      [{ query: "customer_code", relevantChunkIds: ["chunk-1"] }],
      defaultRetrievalSettings,
      false,
    );
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    await act(async () => finish(evaluated));
    expect(screen.getByRole("region", { name: "检索对照评测结果" })).toHaveTextContent(
      "Recall 1.000",
    );
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });
  it("rejects results from another version and does not retry errors", async () => {
    const user = userEvent.setup();
    api.evaluate.mockResolvedValue({ ...evaluated, versionId: "changed" });
    render(
      <RetrievalEvaluationPanel
        libraryId="library"
        versionId="v1"
        query="customer_code"
        result={result}
        settings={defaultRetrievalSettings}
        searchBusy={false}
        onBusyChange={vi.fn()}
      />,
    );
    await prepare(user);
    await user.click(screen.getByRole("button", { name: "确认运行 1 题对照评测" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("标注不能跨版本复用");
    expect(screen.queryByRole("region", { name: "检索对照评测结果" })).not.toBeInTheDocument();
    expect(api.evaluate).toHaveBeenCalledOnce();
  });
  it("hides metrics after retrieval settings change without making another model call", async () => {
    const user = userEvent.setup();
    const onBusyChange = vi.fn();
    const props = {
      libraryId: "library",
      versionId: "v1",
      query: "customer_code",
      result,
      settings: defaultRetrievalSettings,
      searchBusy: false,
      onBusyChange,
    };
    const view = render(<RetrievalEvaluationPanel {...props} />);
    await prepare(user);
    await user.click(screen.getByRole("button", { name: "确认运行 1 题对照评测" }));
    await screen.findByRole("region", { name: "检索对照评测结果" });
    view.rerender(
      <RetrievalEvaluationPanel {...props} settings={{ ...defaultRetrievalSettings, topK: 2 }} />,
    );
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "检索对照评测结果" })).not.toBeInTheDocument(),
    );
    expect(api.evaluate).toHaveBeenCalledOnce();
  });
});
