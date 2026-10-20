import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { credentialApi, type HttpCredentialDetail } from "@/features/http-requests/credentials-api";
import { CredentialManager } from "@/features/http-requests/credential-manager";
import { CredentialAccess } from "@/features/http-requests/credential-access";
import { importCenterWorkflow } from "@/features/admin/workflow-center/import-file";
import { HttpRequestConfig } from "./http-config";
import { httpConfigurationError } from "./http-types";
import {
  canConnect,
  createV2Workflow,
  defaultData,
  outputFields,
  parseInputs,
  type WorkflowV2NodeData,
} from "./types";
import { boundedJson } from "./data-validation";

vi.mock("@/features/admin/api", () => ({ listUsers: vi.fn().mockResolvedValue({ users: [] }) }));
const id = "10000000-0000-0000-0000-000000000001",
  revision = "10000000-0000-0000-0000-000000000002";
function detail(): HttpCredentialDetail {
  return {
    id,
    name: "Synthetic credential",
    description: "test",
    enabled: true,
    currentRevision: revision,
    revisions: [
      {
        id: revision,
        createdAt: "2026-09-16T00:00:00Z",
        hasSecret: true,
        definition: {
          origin: "https://example.com",
          headers: ["Authorization"],
          requests: [{ method: "GET", url: "https://example.com/query" }],
        },
      },
    ],
  };
}
function Harness({
  initial,
  admin = true,
}: {
  initial?: WorkflowV2NodeData<"httpRequest">;
  admin?: boolean;
}) {
  const [data, setData] = useState(initial ?? defaultData("httpRequest"));
  return (
    <>
      <HttpRequestConfig data={data} admin={admin} onChange={setData} />
      <output data-testid="http-data">{JSON.stringify(data)}</output>
    </>
  );
}
function current(): WorkflowV2NodeData<"httpRequest"> {
  return JSON.parse(screen.getByTestId("http-data").textContent!);
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(credentialApi, "catalog").mockResolvedValue([]);
  vi.spyOn(credentialApi, "list").mockResolvedValue([]);
  vi.spyOn(credentialApi, "grants").mockResolvedValue({ grants: [], audit: [] });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

describe("HTTP request node", () => {
  it("keeps the full 1 MiB UTF-8 boundary without changing explicit field constraints", () => {
    const body = "中".repeat(349525) + "x";
    expect(boundedJson(body)).toBe(true);
    expect(boundedJson(body + "x")).toBe(false);
    expect(parseInputs([{ key: "body", type: "string", required: true }], { body })).toEqual({
      body,
    });
    expect(() =>
      parseInputs([{ key: "body", type: "string", required: true, maxLength: 16000 }], { body }),
    ).toThrow();
    const fields = ["first", "second", "third"].map((key) => ({
      key,
      type: "string" as const,
      required: true,
    }));
    expect(() =>
      parseInputs(
        fields,
        Object.fromEntries(fields.map((field) => [field.key, "a".repeat(800000)])),
      ),
    ).toThrow("输入超过节点数据预算");
    let deep: unknown = "value";
    for (let i = 0; i < 1000; i++) deep = [deep];
    expect(boundedJson(deep)).toBe(false);
  });
  it("configures URL, variable query and headers, all body modes and typed extraction", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("HTTP 请求 URL"), {
      target: { value: "https://example.com/query" },
    });
    await user.click(screen.getByRole("button", { name: "添加查询参数" }));
    fireEvent.change(screen.getByLabelText("查询参数 1 名称"), { target: { value: "q" } });
    await user.selectOptions(screen.getByLabelText("查询参数 1 值插入变量"), "question");
    await user.click(screen.getByRole("button", { name: "添加请求头" }));
    fireEvent.change(screen.getByLabelText("请求头 1 名称"), { target: { value: "Accept" } });
    fireEvent.change(screen.getByLabelText("请求头 1 值"), {
      target: { value: "application/json" },
    });
    await user.selectOptions(screen.getByLabelText("HTTP 请求方法"), "POST");
    await user.selectOptions(screen.getByLabelText("HTTP 请求体类型"), "json");
    fireEvent.change(screen.getByLabelText("HTTP 请求正文"), {
      target: { value: '{"query":"{{question}}"}' },
    });
    await user.click(screen.getByRole("button", { name: "添加 JSON 提取字段" }));
    fireEvent.change(screen.getByLabelText("HTTP 提取字段 1 标识"), { target: { value: "count" } });
    await user.selectOptions(screen.getByLabelText("count 类型"), "number");
    fireEvent.change(screen.getByLabelText("HTTP 提取字段 1 路径"), {
      target: { value: "/data/count" },
    });
    expect(
      within(screen.getByLabelText("count 类型")).queryByRole("option", { name: "image" }),
    ).not.toBeInTheDocument();
    expect(current()).toMatchObject({
      http: {
        method: "POST",
        query: [{ name: "q", value: "{{question}}" }],
        headers: [{ name: "Accept", value: "application/json" }],
        bodyType: "json",
      },
      outputFields: [{ key: "count", type: "number" }],
      extract: { count: "/data/count" },
    });
    expect(httpConfigurationError(current(), true)).toBeNull();
    await user.selectOptions(screen.getByLabelText("HTTP 请求体类型"), "form");
    await user.click(screen.getByRole("button", { name: "添加表单字段" }));
    fireEvent.change(screen.getByLabelText("表单字段 1 名称"), { target: { value: "query" } });
    await user.selectOptions(screen.getByLabelText("表单字段 1 值插入变量"), "question");
    expect(current().http!.form).toEqual([{ name: "query", value: "{{question}}" }]);
    await user.selectOptions(screen.getByLabelText("HTTP 请求体类型"), "text");
    expect(screen.getByLabelText("HTTP 请求正文")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("HTTP 请求方法"), "GET");
    expect(screen.getByLabelText("HTTP 请求体类型")).toBeDisabled();
    expect(current().http!.bodyType).toBe("none");
    await user.click(screen.getByLabelText("HTTP 非成功状态时报错"));
    expect(current().http!.failOnHttpError).toBe(false);
  });

  it("binds a fixed credential version without copying secrets and preserves unavailable references", async () => {
    const user = userEvent.setup();
    vi.mocked(credentialApi.catalog).mockResolvedValue([detail()]);
    render(<Harness admin={false} />);
    await user.selectOptions(
      screen.getByLabelText("HTTP 鉴权凭据"),
      (await screen.findByRole("option", { name: "Synthetic credential" })).getAttribute("value")!,
    );
    expect(current()).toMatchObject({ credentialId: id, credentialRevisionId: revision });
    expect(current()).not.toHaveProperty("headers");
    expect(screen.queryByText("管理 HTTP 凭据")).not.toBeInTheDocument();
    vi.mocked(credentialApi.catalog).mockResolvedValue([]);
    await user.click(screen.getByRole("button", { name: "刷新凭据" }));
    await screen.findByRole("option", { name: "原凭据不可用或未获授权" });
    expect(current().credentialRevisionId).toBe(revision);
    await user.selectOptions(screen.getByLabelText("HTTP 鉴权凭据"), "");
    expect(current().credentialId).toBe("");
  });

  it("round trips HTTP nodes and exposes stable compatible output ports", () => {
    const graph = createV2Workflow();
    const node = graph.nodes[1];
    node.type = "httpRequest";
    node.data = defaultData("httpRequest");
    node.data.http!.url = "https://example.com";
    graph.edges = [];
    const end = graph.nodes[2];
    end.data.fields = [{ key: "answer", type: "string", required: true }];
    const connection = {
      source: node.id,
      sourceHandle: "body",
      target: end.id,
      targetHandle: "answer",
    };
    expect(canConnect(graph, connection)).toBe(true);
    expect(canConnect(graph, { ...connection, sourceHandle: "statusCode" })).toBe(false);
    expect(outputFields(node).map((field) => field.key)).toEqual(["statusCode", "body", "headers"]);
    const serialize = () =>
      JSON.stringify({
        format: "creativeflow-workflow",
        formatVersion: 1,
        schemaVersion: 1,
        name: "HTTP",
        graph,
      });
    expect(importCenterWorkflow(serialize())).toMatchObject({ ok: true, graph });
    node.data.http!.url = "https://{{question}}/api";
    expect(importCenterWorkflow(serialize()).ok).toBe(false);
    node.data.http!.url = "https://example.com";
    node.data.http!.headers = [{ name: "Authorization", value: "unsafe-literal" }];
    expect(importCenterWorkflow(serialize()).ok).toBe(false);
  });

  it("reports invalid templates and response field contracts in the node editor", async () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("HTTP 请求 URL"), {
      target: { value: "https://example.com/{{missing}}" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("不存在的输入变量");
    fireEvent.change(screen.getByLabelText("HTTP 请求 URL"), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "添加 JSON 提取字段" }));
    fireEvent.change(screen.getByLabelText("HTTP 提取字段 1 标识"), { target: { value: "body" } });
    expect(screen.getByRole("alert")).toHaveTextContent("不能重复");
    fireEvent.click(screen.getByRole("button", { name: "删除 HTTP 提取字段 1" }));
    expect(current().extract).toEqual({});
    await waitFor(() => expect(credentialApi.catalog).toHaveBeenCalled());
  });
});

describe("HTTP credential management", () => {
  it("saves encrypted-resource input separately, clears the secret and uses the returned revision", async () => {
    const user = userEvent.setup();
    const saved = vi.fn();
    const close = vi.fn();
    const save = vi.spyOn(credentialApi, "save").mockResolvedValue({ id, revisionId: revision });
    vi.spyOn(credentialApi, "detail").mockResolvedValue(detail());
    render(<CredentialManager onSaved={saved} onClose={close} />);
    fireEvent.change(screen.getByLabelText("凭据名称"), { target: { value: "Synthetic" } });
    fireEvent.change(screen.getByLabelText("凭据目标站点"), {
      target: { value: "https://example.com" },
    });
    fireEvent.change(screen.getByLabelText("授权接口 1 地址"), {
      target: { value: "https://example.com/query" },
    });
    fireEvent.change(screen.getByLabelText("凭据请求头 1 值"), {
      target: { value: "Bearer test-only-secret" },
    });
    expect(screen.getByLabelText("凭据请求头 1 值")).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "保存版本并使用" }));
    await waitFor(() => expect(saved).toHaveBeenCalledExactlyOnceWith(id, revision));
    expect(save).toHaveBeenCalledExactlyOnceWith(null, {
      name: "Synthetic",
      origin: "https://example.com",
      description: "",
      headers: [{ name: "Authorization", value: "Bearer test-only-secret" }],
      requests: [{ method: "GET", url: "https://example.com/query" }],
    });
    expect(screen.getByLabelText("凭据请求头 1 值")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(close).toHaveBeenCalledOnce();
  });

  it("retains failed input for explicit retry and blocks double submission and Escape while saving", async () => {
    let reject!: (error: Error) => void;
    const close = vi.fn();
    const saved = vi.fn();
    const save = vi.spyOn(credentialApi, "save").mockImplementation(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    render(<CredentialManager onSaved={saved} onClose={close} />);
    fireEvent.change(screen.getByLabelText("凭据名称"), { target: { value: "Retry" } });
    fireEvent.change(screen.getByLabelText("凭据目标站点"), {
      target: { value: "https://example.com" },
    });
    fireEvent.change(screen.getByLabelText("授权接口 1 地址"), {
      target: { value: "https://example.com/query" },
    });
    fireEvent.change(screen.getByLabelText("凭据请求头 1 值"), {
      target: { value: "test-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存版本并使用" }));
    expect(screen.getByRole("button", { name: "处理中…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "处理中…" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(close).not.toHaveBeenCalled();
    reject(new Error("暂时无法保存"));
    expect(await screen.findByRole("alert")).toHaveTextContent("暂时无法保存");
    expect(screen.getByLabelText("凭据请求头 1 值")).toHaveValue("test-secret");
    expect(save).toHaveBeenCalledOnce();
    expect(saved).not.toHaveBeenCalled();
  });

  it("keeps account and API Key credential grants separate with audit reasons", async () => {
    const user = userEvent.setup();
    const grant = vi.spyOn(credentialApi, "grant").mockResolvedValue();
    render(<CredentialAccess id={id} />);
    await screen.findByText("暂无普通账号或 API Key 授权。");
    await user.selectOptions(screen.getByLabelText("凭据授权身份类型"), "apiKey");
    fireEvent.change(screen.getByLabelText("凭据授权 API Key ID"), {
      target: { value: "synthetic-key-id" },
    });
    await user.click(screen.getByRole("button", { name: "添加授权" }));
    expect(screen.getByRole("button", { name: "确认授权" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("凭据授权调整原因"), { target: { value: "合成测试" } });
    await user.click(screen.getByRole("button", { name: "确认授权" }));
    await waitFor(() =>
      expect(grant).toHaveBeenCalledExactlyOnceWith(
        id,
        "apiKey",
        "synthetic-key-id",
        true,
        "合成测试",
      ),
    );
  });
});
