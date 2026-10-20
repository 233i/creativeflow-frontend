import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { ReactFlowProps } from "@xyflow/react";
import { WorkflowApiError, type createWorkflowApiClient, type WorkflowDocument } from "../api";
import type { WorkflowNodeRun, WorkflowRun } from "../types";
import { createV2Workflow, type WorkflowV2Node } from "./types";
import { WorkflowV2Editor } from "./editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@xyflow/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@xyflow/react")>()),
  Background: () => null,
  Controls: () => null,
  ReactFlow: ({ nodes = [], edges, onNodeClick, children }: ReactFlowProps<WorkflowV2Node>) => (
    <div data-testid="canvas" data-edges={JSON.stringify(edges)}>
      {nodes.map((node) => (
        <button key={node.id} onClick={(event) => onNodeClick?.(event, node)}>
          选择 {node.type}
        </button>
      ))}
      {children as ReactNode}
    </div>
  ),
}));
vi.mock("./node-config", () => ({
  actionClass: "action",
  controlClass: "control",
  V2NodeConfig: ({ node }: { node: WorkflowV2Node }) => <div>配置 {node.type}</div>,
}));
vi.mock("../external-api/publish-panel", () => ({ WorkflowPublishPanel: () => null }));
vi.mock("../readonly-graph", () => ({
  ReadonlyWorkflowGraph: ({ graph, preview }: { graph: unknown; preview: unknown }) => (
    <div
      data-testid="historical-preview"
      data-graph={JSON.stringify(graph)}
      data-preview={JSON.stringify(preview)}
    />
  ),
}));
vi.mock("../initial-graph-fit", () => ({ InitialGraphFit: () => null }));
const time = "2026-09-13T00:00:00Z";
const now = Date.parse(time);
function fixture(kind: "llm" | "knowledgeAnswer" = "llm") {
  const graph = createV2Workflow();
  graph.nodes[1].type = kind;
  const document: WorkflowDocument = {
    id: "workflow",
    name: "合成调试",
    schemaVersion: 1,
    graph,
    createdAt: time,
    updatedAt: time,
  };
  const run: WorkflowRun = {
    id: "run",
    workflowId: document.id,
    status: "running",
    error: null,
    resumedFromRunId: null,
    createdAt: time,
    updatedAt: time,
    startedAt: time,
    finishedAt: null,
    nodes: graph.nodes.map((node, index) => ({
      nodeId: node.id,
      nodeType: node.type as WorkflowNodeRun["nodeType"],
      status: index === 0 ? "succeeded" : index === 1 ? "running" : "queued",
      isReused: false,
      progress: null,
      output: null,
      error: null,
      startedAt: index < 2 ? time : null,
      finishedAt: index === 0 ? time : null,
    })),
  };
  const mocks = {
    getWorkflowCapabilities: vi.fn().mockResolvedValue({
      enabled: true,
      nodeTypes: [
        "start",
        "llm",
        "knowledgeAnswer",
        "knowledgeRetrieve",
        "condition",
        "merge",
        "httpRequest",
        "end",
      ],
    }),
    getWorkflowRun: vi.fn().mockResolvedValue(run),
    getLatestWorkflowRun: vi.fn().mockResolvedValue(run),
    getWorkflowRunSnapshot: vi.fn().mockResolvedValue({ runId: run.id, graph }),
    startWorkflowRun: vi.fn().mockResolvedValue(run),
    saveWorkflow: vi.fn().mockResolvedValue(document),
    resumeWorkflowRun: vi.fn().mockResolvedValue(run),
    cancelWorkflowRun: vi.fn(),
    listWorkflowRuns: vi.fn().mockResolvedValue({ runs: [run] }),
    previewPartialWorkflowRerun: vi.fn().mockResolvedValue({
      sourceRunId: run.id,
      fromNodeId: graph.nodes[1].id,
      rerunNodeIds: [graph.nodes[1].id, graph.nodes[2].id],
      reusedNodeIds: [graph.nodes[0].id],
    }),
    partialRerunWorkflow: vi.fn().mockResolvedValue({ ...run, id: "partial-run" }),
    startNodeDebug: vi.fn(),
    getNodeDebugInputs: vi.fn(),
  };
  return {
    document,
    graph,
    run,
    mocks,
    client: mocks as unknown as ReturnType<typeof createWorkflowApiClient>,
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => {
  vi.useRealTimers();
});
async function flush() {
  await act(async () => {});
}

describe("v2 inspector preserves submission, polling and recovery semantics", () => {
  it("recovers active node debug separately after reopening without replacing the whole run", async () => {
    const { document, graph, run, mocks, client } = fixture();
    run.status = "succeeded";
    const debug: WorkflowRun = {
      ...run,
      id: "debug-recovered",
      debugNodeId: graph.nodes[1].id,
      status: "running",
      nodes: [run.nodes[1]],
    };
    mocks.listWorkflowRuns.mockResolvedValue({ runs: [debug] });
    mocks.getWorkflowRun.mockResolvedValue(debug);
    render(<WorkflowV2Editor initialDocument={document} initialRun={run} client={client} admin />);
    await flush();
    expect(screen.getByRole("button", { name: "运行" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "查看进行中调试" }));
    await flush();
    expect(screen.getByRole("region", { name: "运行详情内容" })).toHaveTextContent(
      "debug-recovered",
    );
    expect(
      JSON.parse(screen.getByTestId("canvas").getAttribute("data-edges")!).every(
        (edge: { animated?: boolean }) => !edge.animated,
      ),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "关闭右侧面板" }));
    fireEvent.click(screen.getByRole("button", { name: "执行详情" }));
    expect(screen.getByRole("region", { name: "运行详情内容" })).not.toHaveTextContent(
      "debug-recovered",
    );
    expect(mocks.startNodeDebug).not.toHaveBeenCalled();
  });
  it("retains an uncertain debug request across closing the drawer and never resends a new key", async () => {
    const { document, graph, mocks, client } = fixture();
    mocks.startNodeDebug.mockRejectedValue(new Error("uncertain submission"));
    render(<WorkflowV2Editor initialDocument={document} initialRun={null} client={client} admin />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "单节点调试" }));
    await flush();
    fireEvent.change(screen.getByLabelText("调试参数 question"), {
      target: { value: "synthetic" },
    });
    fireEvent.click(screen.getByRole("button", { name: "执行此节点" }));
    await flush();
    expect(screen.getByRole("alert")).toHaveTextContent("uncertain submission");
    fireEvent.click(screen.getByRole("button", { name: "关闭右侧面板" }));
    fireEvent.click(screen.getByRole("button", { name: "单节点调试" }));
    await flush();
    expect(screen.queryByRole("button", { name: "执行此节点" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新确认这次提交" }));
    await flush();
    expect(mocks.startNodeDebug).toHaveBeenCalledTimes(2);
    expect(mocks.startNodeDebug.mock.calls[0]).toEqual(mocks.startNodeDebug.mock.calls[1]);
    expect(mocks.startNodeDebug.mock.calls[0].slice(0, 2)).toEqual([
      document.id,
      graph.nodes[1].id,
    ]);
    expect(mocks.startWorkflowRun).not.toHaveBeenCalled();
  });

  it("removes bottom details and keeps polling when the right drawer is closed", async () => {
    const { document, run, mocks, client } = fixture();
    const { container } = render(
      <WorkflowV2Editor initialDocument={document} initialRun={run} client={client} admin />,
    );
    await flush();
    expect(container.querySelector("footer")).toBeNull();
    expect(screen.queryByText(/开始\/结束字段即为 API 参数契约/)).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "执行详情" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "关闭右侧面板" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(mocks.getWorkflowRun).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("complementary", { name: "执行详情" })).not.toBeInTheDocument();
    expect(mocks.cancelWorkflowRun).not.toHaveBeenCalled();
    expect(mocks.startWorkflowRun).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "查看执行详情" }));
    fireEvent.click(screen.getByRole("button", { name: "重新查询" }));
    await flush();
    expect(mocks.getWorkflowRun).toHaveBeenCalledTimes(3);
    expect(mocks.resumeWorkflowRun).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404])(
    "clears the drawer and all cached output after a %i permission failure",
    async (status) => {
      const { document, run, mocks, client } = fixture("knowledgeAnswer");
      run.status = "succeeded";
      run.nodes.forEach((node) => {
        node.status = "succeeded";
      });
      run.nodes[2].output = { fields: { answer: "敏感合成内容" } };
      render(
        <WorkflowV2Editor initialDocument={document} initialRun={run} client={client} admin />,
      );
      await flush();
      fireEvent.click(screen.getByRole("tab", { name: "最终输出" }));
      expect(screen.getByRole("tabpanel")).toHaveTextContent("敏感合成内容");
      mocks.getWorkflowRun.mockRejectedValue(new WorkflowApiError("权限失效", status));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });
      expect(screen.queryByText(/敏感合成内容/)).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("已清除本页结果");
      expect(screen.queryByRole("button", { name: "查看执行详情" })).not.toBeInTheDocument();
      expect(mocks.startWorkflowRun).not.toHaveBeenCalled();
    },
  );

  it("submits once, then opens execution details and saves no runtime edge decoration", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const { document, run, mocks, client } = fixture();
    render(<WorkflowV2Editor initialDocument={document} initialRun={null} client={client} admin />);
    await flush();
    await user.click(screen.getByRole("button", { name: "运行" }));
    await user.type(screen.getByRole("textbox", { name: "问题" }), "合成问题");
    await user.dblClick(screen.getByRole("button", { name: "提交运行" }));
    await flush();
    expect(mocks.startWorkflowRun).toHaveBeenCalledExactlyOnceWith(document.id, {
      question: "合成问题",
    });
    expect(screen.getByRole("complementary", { name: "执行详情" })).toBeVisible();
    expect(screen.getByRole("button", { name: "运行" })).toBeDisabled();
    expect(mocks.saveWorkflow.mock.calls[0][1].edges[0]).not.toHaveProperty("animated");
    expect(JSON.parse(screen.getByTestId("canvas").getAttribute("data-edges")!)[0].animated).toBe(
      true,
    );
    expect(run.status).toBe("running");
  });

  it("queries latest after a lost submit response without resending or silently marking it successful", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const { document, mocks, client } = fixture();
    mocks.startWorkflowRun.mockRejectedValue(new Error("提交响应丢失"));
    render(<WorkflowV2Editor initialDocument={document} initialRun={null} client={client} admin />);
    await flush();
    await user.click(screen.getByRole("button", { name: "运行" }));
    await user.type(screen.getByRole("textbox", { name: "问题" }), "合成问题");
    await user.click(screen.getByRole("button", { name: "提交运行" }));
    await flush();
    expect(mocks.startWorkflowRun).toHaveBeenCalledOnce();
    expect(mocks.getLatestWorkflowRun).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent("提交响应丢失");
  });

  it("only queries an uncertain whole-run submission until a new task is found", async () => {
    const { document, mocks, client, run } = fixture();
    mocks.startWorkflowRun.mockRejectedValue(new Error("response lost"));
    mocks.getLatestWorkflowRun.mockResolvedValue(null);
    render(<WorkflowV2Editor initialDocument={document} initialRun={null} client={client} admin />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "运行" }));
    fireEvent.change(screen.getByLabelText("问题"), { target: { value: "synthetic" } });
    fireEvent.click(screen.getByRole("button", { name: "提交运行" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "提交运行" }));
    await flush();
    expect(mocks.startWorkflowRun).toHaveBeenCalledTimes(1);
    expect(mocks.getLatestWorkflowRun).toHaveBeenCalledTimes(2);
    mocks.getLatestWorkflowRun.mockResolvedValue(run);
    fireEvent.click(screen.getByRole("button", { name: "提交运行" }));
    await flush();
    expect(mocks.startWorkflowRun).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("region", { name: "运行详情内容" })).toHaveTextContent(run.id);
  });
  it("keeps input after save failure and never submits a run", async () => {
    const { document, mocks, client } = fixture();
    mocks.saveWorkflow.mockRejectedValue(new Error("save offline"));
    render(<WorkflowV2Editor initialDocument={document} initialRun={null} client={client} admin />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "运行" }));
    fireEvent.click(screen.getByRole("button", { name: "提交运行" }));
    expect(mocks.saveWorkflow).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("问题"), { target: { value: "retained question" } });
    fireEvent.click(screen.getByRole("button", { name: "提交运行" }));
    await flush();
    expect(screen.getByRole("alert")).toHaveTextContent("save offline");
    expect(screen.getByLabelText("问题")).toHaveValue("retained question");
    expect(mocks.startWorkflowRun).not.toHaveBeenCalled();
    expect(mocks.getLatestWorkflowRun).not.toHaveBeenCalled();
  });
  it("does not apply a pending save or start execution after switching documents", async () => {
    const { document, mocks, client } = fixture();
    let saved!: (value: WorkflowDocument) => void;
    mocks.saveWorkflow.mockReturnValue(
      new Promise<WorkflowDocument>((resolve) => {
        saved = resolve;
      }),
    );
    const view = render(
      <WorkflowV2Editor initialDocument={document} initialRun={null} client={client} admin />,
    );
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "运行" }));
    fireEvent.change(screen.getByLabelText("问题"), { target: { value: "old input" } });
    fireEvent.click(screen.getByRole("button", { name: "提交运行" }));
    await flush();
    view.rerender(
      <WorkflowV2Editor
        initialDocument={{ ...document, id: "second", name: "second document" }}
        initialRun={null}
        client={client}
        admin
      />,
    );
    await act(async () => saved(document));
    expect(screen.getByLabelText("AI 工作流名称")).toHaveValue("second document");
    expect(mocks.startWorkflowRun).not.toHaveBeenCalled();
  });
  it("does not let a polling response from before cancellation restore a running task", async () => {
    const { document, run, mocks, client } = fixture();
    let oldRead!: (value: WorkflowRun) => void;
    mocks.getWorkflowRun
      .mockReturnValueOnce(
        new Promise<WorkflowRun>((resolve) => {
          oldRead = resolve;
        }),
      )
      .mockResolvedValue({ ...run, status: "cancelled" });
    render(<WorkflowV2Editor initialDocument={document} initialRun={run} client={client} admin />);
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(1500));
    fireEvent.click(screen.getByRole("button", { name: "停止" }));
    await flush();
    expect(mocks.getWorkflowRun).toHaveBeenCalledTimes(2);
    await act(async () => oldRead(run));
    expect(screen.queryByRole("button", { name: "停止" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "运行详情内容" })).toHaveTextContent("已取消");
  });
  it("blocks whole-run creation while a node-debug request is still unconfirmed", async () => {
    const { document, mocks, client } = fixture();
    mocks.startNodeDebug.mockRejectedValue(new Error("debug response lost"));
    render(<WorkflowV2Editor initialDocument={document} initialRun={null} client={client} admin />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "单节点调试" }));
    await flush();
    fireEvent.change(screen.getByLabelText("调试参数 question"), { target: { value: "debug" } });
    fireEvent.click(screen.getByRole("button", { name: "执行此节点" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "关闭右侧面板" }));
    fireEvent.click(screen.getByRole("button", { name: "运行" }));
    fireEvent.change(screen.getByLabelText("问题"), { target: { value: "whole" } });
    fireEvent.click(screen.getByRole("button", { name: "提交运行" }));
    await flush();
    expect(mocks.startWorkflowRun).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("调试提交尚未确认");
  });
  it("keeps resume and partial rerun as separate explicit actions and opens their result", async () => {
    const { document, run, mocks, client } = fixture();
    run.status = "failed";
    render(<WorkflowV2Editor initialDocument={document} initialRun={run} client={client} admin />);
    await flush();
    const completed = {
      ...run,
      status: "succeeded" as const,
      nodes: run.nodes.map((node) => ({ ...node, status: "succeeded" as const })),
    };
    mocks.resumeWorkflowRun.mockResolvedValue(completed);
    fireEvent.click(screen.getByRole("button", { name: "继续未执行节点" }));
    await flush();
    expect(mocks.resumeWorkflowRun).toHaveBeenCalledExactlyOnceWith(document.id, run.id);
    fireEvent.click(screen.getByRole("button", { name: "从选中节点重跑" }));
    await flush();
    expect(mocks.partialRerunWorkflow).not.toHaveBeenCalled();
    const confirm = screen.getByRole("dialog", { name: "确认局部重跑" });
    expect(mocks.getWorkflowRunSnapshot).toHaveBeenCalledExactlyOnceWith(document.id, run.id);
    expect(screen.getByTestId("historical-preview")).toHaveAttribute(
      "data-graph",
      JSON.stringify(document.graph),
    );
    fireEvent.click(within(confirm).getByRole("button", { name: "确认重跑" }));
    await flush();
    expect(mocks.partialRerunWorkflow).toHaveBeenCalledOnce();
    expect(screen.getByRole("complementary", { name: "执行详情" })).toHaveTextContent(
      "partial-run",
    );
    expect(mocks.startWorkflowRun).not.toHaveBeenCalled();
  });
});
