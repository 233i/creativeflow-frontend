import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FieldSchemaEditor } from "./schema-editor";
import { ExpressionEditor, StructuredConfig } from "./data-task-config";
import { ModelCallView } from "./model-call-view";
import { NodeDebugPanel, type NodeDebugRequest } from "./node-debug-panel";
import {
  canConnect,
  createV2Workflow,
  defaultData,
  outputFields,
  parseInputs,
  type TransformExpression,
  type WorkflowField,
  type WorkflowV2NodeData,
} from "./types";
import { importCenterWorkflow } from "@/features/admin/workflow-center/import-file";
import { buildWorkflowCurl } from "../external-api/call-example";
import { type createWorkflowApiClient } from "../api";
import type { WorkflowNodeRun, WorkflowRun } from "../types";
import { FieldInput, inputDraft } from "./field-input";
import { V2ModelCalls } from "./model-calls";
import { boundedJson, validExpression, validFieldSchema } from "./data-validation";
import { ScriptConfig } from "./script-config";

const modelCall: NonNullable<NonNullable<WorkflowNodeRun["output"]>["modelCall"]> = {
  id: "call-1",
  nodeId: "llm",
  modelId: "model",
  modelKey: "model-key",
  modelName: "Test Model",
  providerId: "provider",
  providerName: "Test Provider",
  protocol: "openai-chat",
  status: "completed",
  startedAt: "2026-09-13T00:00:00Z",
  outputMode: "json",
  transport: "prompt",
  maxOutputTokens: 512,
  temperature: 0,
  durationMs: 1600,
};
function nodeRun(): WorkflowNodeRun {
  return {
    nodeId: "llm",
    nodeType: "llm" as WorkflowNodeRun["nodeType"],
    status: "succeeded",
    isReused: false,
    progress: 1,
    output: { fields: { text: "test" }, modelCall },
    error: null,
    startedAt: modelCall.startedAt,
    finishedAt: modelCall.startedAt,
  };
}

describe("complete data node configuration", () => {
  it("keeps explicit null, empty strings, enums and historical values distinct", async () => {
    const field: WorkflowField = {
      key: "name",
      type: "string",
      required: true,
      nullable: true,
      enum: ["Ada", ""],
    };
    function Harness() {
      const [draft, setDraft] = useState<Record<string, string>>({});
      return (
        <>
          <FieldInput
            field={field}
            draft={draft}
            onChange={setDraft}
            label="测试姓名"
            className=""
          />
          <output>{JSON.stringify(draft)}</output>
        </>
      );
    }
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("测试姓名"), { target: { value: "Ada" } });
    expect(screen.getByRole("status")).toHaveTextContent('"name":"Ada"');
    fireEvent.change(screen.getByLabelText("测试姓名 值方式"), { target: { value: "null" } });
    expect(screen.getByLabelText("测试姓名")).toBeDisabled();
    expect(parseInputs([field], inputDraft([field], { name: null }))).toEqual({ name: null });
    expect(parseInputs([field], inputDraft([field], { name: "" }))).toEqual({ name: "" });
    expect(() => parseInputs([field], {})).toThrow(/请填写/);
    expect(() => parseInputs([{ ...field, nullable: false }], { "@mode:name": "null" })).toThrow(
      /不允许/,
    );
  });

  it("rejects oversized schemas, unsafe JSON and invalid expression shapes before import", () => {
    expect(
      validFieldSchema([{ key: "x", type: "array", required: true, minItems: 3, maxItems: 2 }]),
    ).toBe(false);
    expect(validFieldSchema([{ key: "x", type: "string", required: true, enum: ["x", "x"] }])).toBe(
      false,
    );
    expect(validExpression({ op: "trim", args: [] })).toBe(false);
    expect(validExpression({ op: "input", input: "x", path: "/bad~3" })).toBe(false);
    expect(validExpression({ op: "constant", value: "x", args: [{ op: "eval" }] })).toBe(false);
    expect(boundedJson(JSON.parse('{"__proto__":{"x":1}}'))).toBe(false);
    expect(() =>
      parseInputs([{ key: "data", type: "object", required: true }], { data: '{"constructor":1}' }),
    ).toThrow(/模式/);
  });
  it("edits nested output fields without requiring raw JSON Schema", async () => {
    function Harness() {
      const [fields, setFields] = useState<WorkflowField[]>([
        { key: "customer", type: "string", required: true },
      ]);
      return (
        <>
          <FieldSchemaEditor fields={fields} onChange={setFields} />
          <output>{JSON.stringify(fields)}</output>
        </>
      );
    }
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("customer 类型"), { target: { value: "object" } });
    expect(screen.getByText("customer 子字段")).toBeVisible();
    fireEvent.change(screen.getByLabelText("customer 子字段 1 标识"), {
      target: { value: "name" },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      '"properties":[{"key":"name","type":"string","required":true}]',
    );
  });

  it("preserves legacy text mode and explicitly switches to native structured format", () => {
    function Harness() {
      const [data, setData] = useState<WorkflowV2NodeData>(defaultData("llm"));
      return (
        <>
          <StructuredConfig
            kind="llm"
            data={data as WorkflowV2NodeData<"llm">}
            onChange={setData}
          />
          <output>{JSON.stringify(data)}</output>
        </>
      );
    }
    render(<Harness />);
    expect(screen.queryByLabelText("结构化请求格式")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("输出模式"), { target: { value: "json" } });
    fireEvent.change(screen.getByLabelText("结构化请求格式"), { target: { value: "json_schema" } });
    expect(screen.getByRole("status")).toHaveTextContent('"outputTransport":"json_schema"');
    expect(screen.getByText(/不自动重试/)).toBeVisible();
  });

  it("edits bounded expression arguments and preserves typed constants", () => {
    function Harness() {
      const [expression, setExpression] = useState<TransformExpression>({
        op: "input",
        input: "text",
      });
      return (
        <>
          <ExpressionEditor
            fields={[{ key: "text", type: "string", required: true }]}
            value={expression}
            onChange={setExpression}
          />
          <output>{JSON.stringify(expression)}</output>
        </>
      );
    }
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("表达式 操作"), { target: { value: "toNumber" } });
    fireEvent.change(screen.getByLabelText("表达式 参数 1 常量值"), { target: { value: "3.5" } });
    expect(screen.getByRole("status")).toHaveTextContent(
      '"op":"toNumber","args":[{"op":"constant","value":"3.5"}]',
    );
  });

  it("uses stable intent branch ports with an undeletable default route", () => {
    const graph = createV2Workflow();
    graph.nodes[1].type = "intentClassify";
    graph.nodes[1].data = defaultData("intentClassify");
    const target = {
      ...graph.nodes[1],
      id: "target",
      type: "llm" as const,
      data: defaultData("llm"),
    };
    graph.nodes.push(target);
    expect(
      canConnect(
        { ...graph, edges: [] },
        {
          source: graph.nodes[1].id,
          sourceHandle: "else",
          target: target.id,
          targetHandle: "$flow",
        },
      ),
    ).toBe(true);
    expect(
      canConnect(
        { ...graph, edges: [] },
        {
          source: graph.nodes[1].id,
          sourceHandle: "unknown",
          target: target.id,
          targetHandle: "$flow",
        },
      ),
    ).toBe(false);
    expect(outputFields(graph.nodes[1])[0].key).toBe("route");
  });

  it("validates nested input types and emits a usable published example", () => {
    const fields: WorkflowField[] = [
      {
        key: "customer",
        type: "object",
        required: true,
        properties: [{ key: "level", type: "string", enum: ["gold"], required: true }],
      },
    ];
    expect(parseInputs(fields, { customer: '{"level":"gold"}' })).toEqual({
      customer: { level: "gold" },
    });
    expect(() => parseInputs(fields, { customer: '{"level":2}' })).toThrow(/模式/);
    expect(() => parseInputs(fields, { customer: '{"level":"gold","extra":1}' })).toThrow(/模式/);
    expect(buildWorkflowCurl("id", fields)).toContain('"level": "gold"');
  });

  it("round-trips new node schemas and rejects unsafe imported expressions", () => {
    const graph = createV2Workflow();
    graph.nodes[1].type = "transform";
    graph.nodes[1].data = defaultData("transform");
    graph.edges = [];
    const serialize = () =>
      JSON.stringify({
        format: "creativeflow-workflow",
        formatVersion: 1,
        schemaVersion: 1,
        name: "test",
        graph,
      });
    expect(importCenterWorkflow(serialize()).ok).toBe(true);
    graph.nodes[1].data.assignments![0].expression = { op: "eval", args: [] };
    expect(importCenterWorkflow(serialize()).ok).toBe(false);
  });

  it("exposes the sandbox language, source and strict output contract", () => {
    function Harness() {
      const [data, setData] = useState(defaultData("script"));
      return (
        <>
          <ScriptConfig data={data} onChange={setData} />
          <output>{JSON.stringify(data)}</output>
        </>
      );
    }
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("脚本语言"), { target: { value: "javascript" } });
    fireEvent.change(screen.getByLabelText("脚本代码"), { target: { value: "console.log(1)" } });
    expect(screen.getByRole("status")).toHaveTextContent('"language":"javascript"');
    expect(screen.getByRole("status")).toHaveTextContent('"code":"console.log(1)"');
    expect(screen.getByText("脚本输出字段")).toBeVisible();
  });
});

describe("actual model call receipts", () => {
  it.each(["unknown", "completed"] as const)(
    "explains length truncation in %s receipts without changing usage",
    (status) => {
      const node = nodeRun();
      node.status = "failed";
      node.output!.modelCall = {
        ...modelCall,
        status,
        finishReason: "length",
        httpStatus: 200,
        usage: { prompt_tokens: 7191, completion_tokens: 4096, total_tokens: 11287 },
      };
      render(<ModelCallView node={node} />);
      expect(screen.getByText("输出被截断（length）")).toBeVisible();
      expect(screen.getByText(/请提高节点的最大输出 token/)).toBeVisible();
      expect(screen.queryByText("调用状态待核对")).not.toBeInTheDocument();
      expect(screen.getByText("4096")).toBeVisible();
      expect(screen.getByText("200")).toBeVisible();
    },
  );
  it("does not count historical receipts or missing usage as fresh zero-cost calls", () => {
    const current = nodeRun(),
      reused = { ...nodeRun(), nodeId: "old", isReused: true };
    const graph = createV2Workflow();
    const run = { nodes: [current, reused], status: "succeeded" } as WorkflowRun;
    render(<V2ModelCalls run={run} graph={graph} onLocate={() => {}} />);
    const summary = screen.getByLabelText("本次模型调用汇总");
    expect(summary).toHaveTextContent("已记录本次调用 1 次");
    expect(summary).toHaveTextContent("复用历史 1 次");
    expect(summary).toHaveTextContent("未完整报告");
  });
  it("shows unknown usage instead of zero and preserves the real provider", () => {
    render(<ModelCallView node={nodeRun()} />);
    expect(screen.getByRole("region", { name: "模型调用记录" })).toHaveTextContent("Test Provider");
    expect(screen.getAllByText("未知").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("1.60 秒")).toBeVisible();
  });
  it("labels reused receipts and unfinished requests honestly", () => {
    const node = nodeRun();
    node.isReused = true;
    node.output!.modelCall = { ...modelCall, status: "requesting" };
    render(<ModelCallView node={node} />);
    expect(screen.getByText(/本次未再次调用/)).toBeVisible();
    expect(screen.getByText(/待核对：请求后未确认结果/)).toBeVisible();
  });
});

describe("single-node debug lifecycle", () => {
  function setup(submit = vi.fn<(input: NodeDebugRequest) => Promise<WorkflowRun>>()) {
    const graph = createV2Workflow();
    const node = graph.nodes[1];
    const run: WorkflowRun = {
      id: "debug-1",
      workflowId: "workflow",
      debugNodeId: node.id,
      resumedFromRunId: null,
      status: "queued",
      error: null,
      createdAt: modelCall.startedAt,
      updatedAt: modelCall.startedAt,
      startedAt: null,
      finishedAt: null,
      nodes: [{ ...nodeRun(), nodeId: node.id, status: "queued", output: null }],
    };
    const client = {
      listWorkflowRuns: vi.fn().mockResolvedValue({ runs: [] }),
      getNodeDebugInputs: vi.fn(),
      getWorkflowRun: vi.fn().mockResolvedValue(run),
      cancelWorkflowRun: vi.fn(),
    };
    function Harness() {
      const [current, setCurrent] = useState<WorkflowRun | null>(null);
      return (
        <NodeDebugPanel
          workflowId="workflow"
          node={node}
          graph={graph}
          client={client as unknown as ReturnType<typeof createWorkflowApiClient>}
          run={current}
          onRun={setCurrent}
          blocked={false}
          onSubmit={submit}
          onLocate={() => {}}
        />
      );
    }
    return { graph, node, run, client, submit, Harness };
  }

  it("submits only the selected node and prevents duplicate active submissions", async () => {
    const f = setup();
    f.submit.mockResolvedValue(f.run);
    const user = userEvent.setup();
    render(<f.Harness />);
    await user.type(screen.getByLabelText("调试参数 question"), "synthetic input");
    await user.dblClick(screen.getByRole("button", { name: "执行此节点" }));
    await waitFor(() => expect(f.submit).toHaveBeenCalledTimes(1));
    expect(f.submit.mock.calls[0][0].inputs).toEqual({ question: "synthetic input" });
    expect(screen.getByRole("button", { name: "执行此节点" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "停止调试" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "继续未执行节点" })).not.toBeInTheDocument();
  });

  it("reconfirms an uncertain submit using the original request and idempotency key", async () => {
    const f = setup();
    f.submit.mockRejectedValueOnce(new Error("response lost")).mockResolvedValueOnce(f.run);
    const user = userEvent.setup();
    render(<f.Harness />);
    await user.type(screen.getByLabelText("调试参数 question"), "input");
    await user.click(screen.getByRole("button", { name: "执行此节点" }));
    expect(await screen.findByText("response lost")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "重新确认这次提交" }));
    expect(f.submit.mock.calls[0][0]).toEqual(f.submit.mock.calls[1][0]);
  });

  it("does not allow manual knowledge evidence", async () => {
    const f = setup();
    f.node.type = "knowledgeAnswer";
    f.node.data = defaultData("knowledgeAnswer");
    render(<f.Harness />);
    fireEvent.change(screen.getByLabelText("调试参数 question"), { target: { value: "question" } });
    fireEvent.click(screen.getByRole("button", { name: "执行此节点" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("知识证据只能来自历史运行");
    expect(f.submit).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole("region", { name: "单节点调试" })).queryByLabelText(
        "调试参数 context",
      ),
    ).not.toBeInTheDocument();
  });

  it("debugs a new original question without overwriting a historical retrieval query", async () => {
    const f = setup();
    f.node.type = "knowledgeAnswer";
    f.node.data = defaultData("knowledgeAnswer");
    f.client.listWorkflowRuns.mockResolvedValue({
      runs: [{ id: "history", status: "succeeded", createdAt: modelCall.startedAt }],
    });
    const context = {
      question: "保修 期限",
      retrievalNodeId: "retrieve",
      libraryId: "library",
      versionId: "fixed-version",
      hits: [],
    };
    f.client.getNodeDebugInputs.mockResolvedValue({
      inputs: { question: "原始问题的完整问法", context },
    });
    f.submit.mockResolvedValue(f.run);
    render(<f.Harness />);
    await screen.findByRole("option", { name: /整图运行/ });
    fireEvent.change(screen.getByLabelText("调试输入来源"), { target: { value: "history" } });
    await screen.findByDisplayValue("原始问题的完整问法");
    expect(screen.getByText(/原始问题 \*/)).toBeInTheDocument();
    expect(screen.getByText("检索上下文 · 只读历史证据")).toBeInTheDocument();
    expect(screen.getByText(/"question": "保修 期限"/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("调试参数 question"), {
      target: { value: "这个产品保修多久？" },
    });
    fireEvent.click(screen.getByRole("button", { name: "执行此节点" }));
    await waitFor(() => expect(f.submit).toHaveBeenCalledOnce());
    expect(f.submit.mock.calls[0][0]).toMatchObject({
      sourceRunId: "history",
      inputs: { question: "这个产品保修多久？" },
    });
    expect(f.submit.mock.calls[0][0].inputs).not.toHaveProperty("context");
    expect(context.question).toBe("保修 期限");
  });
});
