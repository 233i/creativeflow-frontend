import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiModel, AiProvider } from "@/features/ai/types";
import type { RerankSettings, RerankTestResult } from "@/features/ai/rerank-api";
import { RerankModelDialog } from "./rerank-model-dialog";

const api = vi.hoisted(() => ({ settings: vi.fn(), save: vi.fn(), test: vi.fn() }));
vi.mock("@/features/ai/rerank-api", () => ({ rerankApi: api }));
const settings: RerankSettings = {
  endpointPath: "rerank",
  modelRevision: "revision-1",
  maxDocuments: 64,
  maxDocumentCharacters: 4096,
  maxQueryCharacters: 4000,
  timeoutSeconds: 60,
  concurrency: 1,
};
const model = {
  id: "rerank-1",
  modelKey: "rerank-v3",
  name: "Rerank",
  enabled: true,
  type: "rerank",
  category: "rerank",
} as AiModel;
const provider = {
  id: "provider-1",
  name: "Synthetic",
  type: "rerank",
  baseUrl: "https://synthetic.example/v2",
  enabled: true,
  models: [model],
} as AiProvider;
const success: RerankTestResult = {
  ok: true,
  code: null,
  error: null,
  statusCode: 200,
  results: [
    { index: 1, score: 0.9 },
    { index: 0, score: 0.1 },
  ],
  elapsedMilliseconds: 25,
  configurationVersion: "v1",
  totalTokens: 15,
};
beforeEach(() => {
  vi.resetAllMocks();
  api.settings.mockResolvedValue({ settings, version: "v1" });
  api.save.mockImplementation(async (_id: string, value: RerankSettings) => ({
    settings: value,
    version: "v2",
  }));
  api.test.mockResolvedValue(success);
});
describe("RerankModelDialog", () => {
  it("reads configuration without inference and renders indexed results after explicit testing", async () => {
    const user = userEvent.setup();
    render(<RerankModelDialog provider={provider} model={model} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "发送重排序测试" })).toBeEnabled(),
    );
    expect(api.test).not.toHaveBeenCalled();
    expect(screen.getByText("https://synthetic.example/v2/rerank")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "发送重排序测试" }));
    expect(api.test).toHaveBeenCalledExactlyOnceWith(
      "rerank-1",
      expect.any(String),
      expect.any(Array),
      expect.any(AbortSignal),
    );
    expect(await screen.findByRole("region", { name: "重排序测试结果" })).toHaveTextContent(
      "候选 2 · 分数 0.9000",
    );
    expect(screen.getByRole("region", { name: "重排序测试结果" })).toHaveTextContent(
      "保修期限为三年",
    );
  });
  it("requires saving a new or edited immutable configuration before testing", async () => {
    const user = userEvent.setup();
    api.settings.mockResolvedValue({ settings, version: null });
    render(<RerankModelDialog provider={provider} model={model} onClose={vi.fn()} />);
    const field = await screen.findByRole("textbox", { name: "模型修订标识" });
    expect(screen.getByRole("button", { name: "发送重排序测试" })).toBeDisabled();
    await user.clear(field);
    await user.type(field, "revision-2");
    await user.click(screen.getByRole("button", { name: "保存重排配置" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "发送重排序测试" })).toBeEnabled(),
    );
    expect(api.save).toHaveBeenCalledWith(
      "rerank-1",
      expect.objectContaining({ modelRevision: "revision-2" }),
    );
    expect(api.test).not.toHaveBeenCalled();
    await user.type(field, "-changed");
    expect(screen.getByRole("button", { name: "发送重排序测试" })).toBeDisabled();
  });
  it("blocks wrong protocols and disabled models rather than calling the chat endpoint", async () => {
    render(
      <RerankModelDialog
        provider={provider}
        model={{ ...model, type: "openai-chat" }}
        onClose={vi.fn()}
      />,
    );
    await screen.findByRole("textbox", { name: /相对接口路径/ });
    expect(screen.getByRole("button", { name: "发送重排序测试" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("协议覆盖设为 rerank");
    expect(api.test).not.toHaveBeenCalled();
  });
  it("holds a single request lock and does not retry ambiguous failures", async () => {
    const user = userEvent.setup();
    let finish!: (result: RerankTestResult) => void;
    api.test.mockImplementation(
      () =>
        new Promise<RerankTestResult>((resolve) => {
          finish = resolve;
        }),
    );
    render(<RerankModelDialog provider={provider} model={model} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "发送重排序测试" })).toBeEnabled(),
    );
    await user.dblClick(screen.getByRole("button", { name: "发送重排序测试" }));
    expect(api.test).toHaveBeenCalledOnce();
    await act(async () => {
      finish({
        ...success,
        ok: false,
        results: [],
        code: "timeout_unknown",
        error: "请求状态不明，未自动重试。",
      });
    });
    expect(screen.getByRole("region", { name: "重排序测试结果" })).toHaveTextContent("未自动重试");
    expect(api.test).toHaveBeenCalledOnce();
  });
  it("aborts in-flight model testing when unmounted", async () => {
    const user = userEvent.setup();
    api.test.mockImplementation(() => new Promise(() => {}));
    const view = render(<RerankModelDialog provider={provider} model={model} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "发送重排序测试" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "发送重排序测试" }));
    const signal = api.test.mock.calls[0][3] as AbortSignal;
    expect(signal.aborted).toBe(false);
    view.unmount();
    expect(signal.aborted).toBe(true);
  });
});
