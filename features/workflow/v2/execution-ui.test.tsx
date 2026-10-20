import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { WorkflowNodeRun, WorkflowRun } from "../types";
import { createV2Workflow, defaultData, NODE_LABELS, type WorkflowV2Kind } from "./types";
import { NODE_DRAG_MIME } from "./placement";
import { V2NodeLibrary } from "./node-library";
import { V2RunPanel } from "./run-panel";
import { V2RunProgress } from "./run-progress";
import { V2RunStatus } from "./run-status";
import { V2Inspector } from "./inspector";
import { V2NodeCard, V2RunContext } from "./node-card";

const update = vi.hoisted(() => vi.fn());
vi.mock("@xyflow/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@xyflow/react")>()),
  Handle: () => null,
  useUpdateNodeInternals: () => update,
}));
const time = "2026-09-13T00:00:00Z";
const now = Date.parse(time) + 45000;
function fixture() {
  const graph = createV2Workflow();
  graph.nodes[1].data.title = "整理回答";
  const run: WorkflowRun = {
    id: "synthetic-run",
    workflowId: "synthetic-workflow",
    resumedFromRunId: null,
    status: "running",
    error: null,
    createdAt: time,
    updatedAt: time,
    startedAt: time,
    finishedAt: null,
    nodes: graph.nodes.map((node, index) => ({
      nodeId: node.id,
      nodeType: node.type as WorkflowNodeRun["nodeType"],
      status: index === 0 ? "succeeded" : index === 1 ? "running" : "queued",
      isReused: index === 0,
      progress: null,
      output: null,
      error: null,
      startedAt: index < 2 ? time : null,
      finishedAt: index === 0 ? time : null,
    })),
  };
  return { graph, run };
}

describe("v2 canvas execution interactions", () => {
  it("labels retrieval and answer inputs differently on the actual canvas cards", () => {
    const { graph } = fixture();
    const props = {
      ...graph.nodes[1],
      type: "knowledgeRetrieve" as const,
      data: defaultData("knowledgeRetrieve"),
      selected: false,
      isConnectable: true,
      positionAbsoluteX: 0,
      positionAbsoluteY: 0,
      draggable: true,
      dragging: false,
      selectable: true,
      deletable: true,
      zIndex: 0,
    };
    const { rerender } = render(<V2NodeCard {...props} />);
    expect(screen.getByText("检索词 *")).toBeVisible();
    rerender(
      <V2NodeCard {...props} type="knowledgeAnswer" data={defaultData("knowledgeAnswer")} />,
    );
    expect(screen.getByText("原始问题 *")).toBeVisible();
    expect(screen.getByText("检索上下文 *")).toBeVisible();
    expect(screen.queryByText("检索词 *")).not.toBeInTheDocument();
  });

  it("provides accessible canvas-style tools with click and native drag payloads", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const kinds = Object.keys(NODE_LABELS) as WorkflowV2Kind[];
    const { rerender } = render(
      <V2NodeLibrary kinds={kinds} busy={false} nodeCount={7} onAdd={onAdd} />,
    );
    const library = screen.getByRole("complementary", { name: "节点库" });
    for (const kind of kinds)
      expect(within(library).getByRole("button", { name: NODE_LABELS[kind] })).toBeInTheDocument();
    expect(within(library).getByRole("button", { name: "展开节点库" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(library).not.toHaveTextContent("拖拽节点到画布创建");
    await user.click(within(library).getByRole("button", { name: "知识检索" }));
    expect(onAdd).toHaveBeenCalledExactlyOnceWith("knowledgeRetrieve");
    const transfer = { setData: vi.fn(), effectAllowed: "none" };
    fireEvent.dragStart(within(library).getByRole("button", { name: "知识问答" }), {
      dataTransfer: transfer,
    });
    expect(transfer.setData).toHaveBeenCalledWith(NODE_DRAG_MIME, "knowledgeAnswer");
    expect(transfer.effectAllowed).toBe("copy");
    expect(onAdd).toHaveBeenCalledOnce();
    rerender(<V2NodeLibrary kinds={kinds} busy={false} nodeCount={40} onAdd={onAdd} />);
    expect(screen.getByRole("button", { name: "知识检索" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "开始" })).toBeEnabled();
    rerender(<V2NodeLibrary kinds={kinds} busy nodeCount={7} onAdd={onAdd} />);
    for (const kind of kinds)
      expect(within(library).getByRole("button", { name: NODE_LABELS[kind] })).toBeDisabled();
    await user.click(within(library).getByRole("button", { name: "展开节点库" }));
    await user.type(within(library).getByRole("textbox", { name: "搜索节点" }), "知识");
    expect(within(library).queryByRole("button", { name: "开始" })).not.toBeInTheDocument();
    expect(within(library).getByRole("button", { name: "知识问答" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(within(library).getByRole("button", { name: "展开节点库" })).toHaveFocus();
  });

  it("shows live steps, elapsed time and reused results; querying never invokes resume", async () => {
    const user = userEvent.setup();
    const { graph, run } = fixture();
    const refresh = vi.fn(),
      resume = vi.fn(),
      locate = vi.fn();
    render(
      <V2RunPanel
        run={run}
        graph={graph}
        now={now}
        busy={false}
        onRefresh={refresh}
        onResume={resume}
        onLocate={locate}
      />,
    );
    expect(screen.getByRole("tab", { name: "执行过程" })).toHaveAttribute("aria-selected", "true");
    const list = screen.getByRole("list", { name: "运行节点明细" });
    expect(list.querySelector('[aria-current="step"]')).toHaveTextContent("整理回答");
    expect(list.querySelector('[aria-current="step"]')).toHaveTextContent("45 秒");
    expect(within(list).getByText("已复用")).toBeVisible();
    fireEvent.click(list.querySelector("summary")!);
    await user.click(within(list).getAllByRole("button", { name: "在画布中定位" })[0]);
    expect(locate).toHaveBeenCalledWith(run.nodes[0].nodeId);
    await user.click(screen.getByRole("button", { name: "重新查询" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(resume).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "继续未执行节点" })).not.toBeInTheDocument();
    screen.getByRole("tab", { name: "执行过程" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "模型调用" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "最终输出" })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("任务执行中");
  });

  it("keeps failure recovery explicit and separates successful final output from step details", async () => {
    const user = userEvent.setup();
    const { graph, run } = fixture();
    const resume = vi.fn();
    run.status = "failed";
    run.error = "合成超时";
    run.nodes[1].status = "failed";
    run.nodes[2].status = "skipped";
    const props = {
      graph,
      now,
      busy: false,
      onRefresh: vi.fn(),
      onResume: resume,
      onLocate: vi.fn(),
    };
    const { rerender } = render(<V2RunPanel {...props} run={run} />);
    expect(screen.getByRole("alert")).toHaveTextContent("合成超时");
    expect(screen.getByText("已跳过")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "继续未执行节点" }));
    expect(resume).toHaveBeenCalledOnce();
    run.status = "succeeded";
    run.error = null;
    run.finishedAt = "2026-09-13T00:00:12Z";
    run.nodes.forEach((node) => {
      node.status = "succeeded";
      node.finishedAt = run.finishedAt;
    });
    run.nodes[2].output = { fields: { answer: "合成最终结果" } };
    rerender(<V2RunPanel {...props} run={{ ...run }} />);
    await user.click(screen.getByRole("tab", { name: "最终输出" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("合成最终结果");
    expect(screen.getByText("12 秒")).toBeVisible();
  });

  it("keeps node retry, skip and rollback separate and disables busy run actions", async () => {
    const user = userEvent.setup();
    const { graph, run } = fixture();
    run.status = "failed";
    run.nodes[1].status = "failed";
    const props = {
      run,
      graph,
      now,
      busy: false,
      onRefresh: vi.fn(),
      onResume: vi.fn(),
      onLocate: vi.fn(),
      onRetryNode: vi.fn(),
      onSkipNode: vi.fn(),
      onRollback: vi.fn(),
    };
    const { rerender } = render(<V2RunPanel {...props} />);
    expect(props.onRetryNode).not.toHaveBeenCalled();
    expect(props.onSkipNode).not.toHaveBeenCalled();
    expect(props.onRollback).not.toHaveBeenCalled();
    const list = screen.getByRole("list", { name: "运行节点明细" });
    const step = within(list).getByText("整理回答").closest("li")!;
    fireEvent.click(within(step).getByText("整理回答").closest("summary")!);
    await user.click(within(step).getByRole("button", { name: "从此节点重试" }));
    expect(props.onRetryNode).toHaveBeenCalledExactlyOnceWith(run.nodes[1].nodeId);
    await user.click(within(step).getByRole("button", { name: "跳过节点" }));
    expect(props.onSkipNode).toHaveBeenCalledExactlyOnceWith(run.nodes[1].nodeId);
    await user.click(screen.getByRole("button", { name: "从失败节点回滚重跑" }));
    expect(props.onRollback).toHaveBeenCalledExactlyOnceWith(run.nodes[1].nodeId);
    expect(props.onResume).not.toHaveBeenCalled();

    rerender(<V2RunPanel {...props} busy />);
    for (const name of ["重新查询", "继续未执行节点", "从失败节点回滚重跑"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      await user.click(button);
    }
    expect(props.onRefresh).not.toHaveBeenCalled();
    expect(props.onResume).not.toHaveBeenCalled();
    expect(props.onRollback).toHaveBeenCalledOnce();

    rerender(<V2RunPanel {...props} run={{ ...run, debugNodeId: run.nodes[1].nodeId }} />);
    expect(screen.queryByRole("button", { name: "继续未执行节点" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "从失败节点回滚重跑" })).not.toBeInTheDocument();
  });

  it("shows retry timing and attempts without offering another retry while waiting", async () => {
    const user = userEvent.setup();
    const { graph, run } = fixture();
    Object.assign(run.nodes[1], {
      status: "retrying",
      progress: 0.4,
      attempt: 2,
      maxAttempts: 3,
      retryAt: time,
    });
    const retry = vi.fn();
    const skip = vi.fn();
    render(
      <V2RunPanel
        run={run}
        graph={graph}
        now={now}
        busy={false}
        onRefresh={vi.fn()}
        onResume={vi.fn()}
        onLocate={vi.fn()}
        onRetryNode={retry}
        onSkipNode={skip}
      />,
    );
    const step = screen
      .getByRole("list", { name: "运行节点明细" })
      .querySelector('[aria-current="step"]')! as HTMLElement;
    expect(step).toHaveTextContent("等待重试 40%");
    fireEvent.click(within(step).getByText("整理回答").closest("summary")!);
    expect(within(step).getByText(/等待自动重试/)).toBeVisible();
    expect(within(step).getByText("尝试 2 / 3")).toBeVisible();
    expect(within(step).queryByRole("button", { name: "从此节点重试" })).not.toBeInTheDocument();
    await user.click(within(step).getByRole("button", { name: "跳过节点" }));
    expect(skip).toHaveBeenCalledExactlyOnceWith(run.nodes[1].nodeId);
    expect(retry).not.toHaveBeenCalled();
  });

  it.each([
    ["running", "执行中 42%", "text-primary"],
    ["retrying", "等待重试 42%", "text-primary"],
    ["succeeded", "已复用", "text-blue-600"],
    ["failed", "失败", "text-destructive"],
    ["cancelled", "已取消", "text-muted-foreground"],
    ["skipped", "已跳过", "text-muted-foreground"],
    ["queued", "等待执行", "text-muted-foreground"],
  ] as const)(
    "preserves %s status presentation even when marked reused",
    (status, label, color) => {
      render(<V2RunStatus status={status} reused progress={42} />);
      const badge = screen.getByText(label);
      expect(badge).toHaveClass(color);
      if (status === "running" || status === "retrying")
        expect(badge.querySelector("svg")).toHaveClass("animate-spin");
      else expect(badge.querySelector("svg")).not.toHaveClass("animate-spin");
    },
  );

  it("does not claim a running task is finished between node updates", () => {
    const { graph, run } = fixture();
    run.nodes[1].status = "queued";
    const { rerender } = render(
      <V2RunProgress run={run} graph={graph} now={now} onOpen={vi.fn()} />,
    );
    expect(screen.getByText("正在调度下一步")).toBeVisible();
    run.status = "queued";
    rerender(<V2RunProgress run={{ ...run }} graph={graph} now={now} onOpen={vi.fn()} />);
    expect(screen.getByText("等待调度，任务已保存")).toBeVisible();
  });

  it("highlights the executing card and shows percentage only when reported by the server", () => {
    const { graph, run } = fixture();
    const props = {
      ...graph.nodes[1],
      selected: false,
      isConnectable: true,
      positionAbsoluteX: 0,
      positionAbsoluteY: 0,
      draggable: true,
      dragging: false,
      selectable: true,
      deletable: true,
      zIndex: 0,
    };
    const { rerender, container } = render(
      <V2RunContext.Provider value={run}>
        <V2NodeCard {...props} />
      </V2RunContext.Provider>,
    );
    expect(container.querySelector("section")).toHaveClass("canvas-node-busy");
    expect(screen.getByText("执行中")).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    run.nodes[1].progress = 0.42;
    rerender(
      <V2RunContext.Provider value={{ ...run }}>
        <V2NodeCard {...props} />
      </V2RunContext.Provider>,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByText("执行中 42%")).toBeVisible();
    run.nodes[1].status = "skipped";
    rerender(
      <V2RunContext.Provider value={{ ...run }}>
        <V2NodeCard {...props} />
      </V2RunContext.Provider>,
    );
    expect(container.querySelector("section")).not.toHaveClass("canvas-node-busy");
    expect(screen.getByText("已跳过")).toBeVisible();
  });

  it("closes the desktop inspector with Escape without requiring a cancel callback", async () => {
    const user = userEvent.setup();
    const close = vi.fn(),
      mode = vi.fn();
    render(
      <V2Inspector mode="run" hasRun hasNode onMode={mode} onClose={close}>
        <p>运行内容</p>
      </V2Inspector>,
    );
    const panel = screen.getByRole("complementary", { name: "执行详情" });
    await user.click(within(panel).getByRole("button", { name: "节点配置" }));
    expect(mode).toHaveBeenCalledWith("node");
    await act(async () => {
      fireEvent.keyDown(panel, { key: "Escape" });
    });
    expect(close).toHaveBeenCalledOnce();
  });
});
