import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RequestHistoryPanel } from "./request-history-panel";
import { artifactUrl, RequestDetailView } from "./request-detail";
import {
  getRequest,
  listRequests,
  type RequestDetail,
  type RequestPage,
  type RequestSummary,
} from "./api";

/** 虚构的请求行；测试不读取真实用户数据。 */
const summary: RequestSummary = {
  id: "019aaaaa-0000-7000-8000-000000000001",
  source: "canvas",
  kind: "text",
  status: "succeeded",
  accountId: "user-a",
  userName: "用户甲",
  email: "a@example.invalid",
  projectId: "canvas-a",
  projectName: "测试画布",
  nodeId: "text-1",
  modelKey: "chat-model",
  providerName: "测试渠道",
  createdAt: "2026-09-06T01:00:00Z",
  finishedAt: "2026-09-06T01:01:00Z",
  error: null,
  historical: false,
};

/** 返回带可控 JSON 正文的成功响应。 */
function response(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

/** 使用固定行构造分页结果。 */
function page(row = summary): RequestPage {
  return { items: [row], total: 1, offset: 0, limit: 30 };
}

/** 创建文本产物详情。 */
function detail(row = summary): RequestDetail {
  return {
    summary: row,
    input: { prompt: "请求输入" },
    artifacts: [
      {
        kind: "text",
        text: "实际文本产物",
        assetId: null,
        url: null,
        mediaType: null,
        unavailable: false,
      },
    ],
    nodes: [],
  };
}

beforeEach(() => {
  window.history.replaceState(null, "", "/admin/runs");
  // TDesign 使用浏览器布局观察器；此处只替换 JSDOM 缺失的浏览器能力。
  vi.stubGlobal(
    "ResizeObserver",
    class {
      /** 测试环境不计算元素尺寸。 */
      observe() {}
      /** 停止观察不需要释放布局资源。 */
      unobserve() {}
      /** 对齐浏览器观察器的清理契约。 */
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("管理请求记录", () => {
  it("encodes user filters and retains the admin session on both endpoints", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(page()));
    vi.stubGlobal("fetch", fetchMock);
    await listRequests({
      source: "workflow",
      search: "  张三+@example.invalid &  ",
      accountId: "user-a",
      status: "cancelled",
      offset: 30,
    });
    const [url, options] = fetchMock.mock.calls[0];
    const query = new URL(url, "http://localhost").searchParams;
    expect(query.get("search")).toBe("张三+@example.invalid &");
    expect(query.get("accountId")).toBe("user-a");
    expect(query.get("source")).toBe("workflow");
    expect(query.get("offset")).toBe("30");
    expect(options.credentials).toBe("include");
    fetchMock.mockResolvedValue(response(detail()));
    await getRequest("canvas", summary.id);
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/v1/admin/requests/canvas/${summary.id}`);
  });

  it("separates canvas and workflow records and opens real text output", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (!url.includes("?")) return response(detail());
      return response(
        page(
          url.includes("source=workflow")
            ? { ...summary, source: "workflow", kind: "workflow", projectName: "测试工作流" }
            : summary,
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<RequestHistoryPanel />);
    expect(await screen.findByText("测试画布")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看详情" }));
    expect(await screen.findByText("实际文本产物")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "工作流记录" }));
    expect(await screen.findByText("测试工作流")).toBeInTheDocument();
    expect(screen.queryByText("实际文本产物")).not.toBeInTheDocument();
  });

  it("keeps an exact user filter when switching source and resets page on search", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => response(page()));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <RequestHistoryPanel
        initialUser={{
          id: "user-a",
          displayName: "用户甲",
          email: null,
          isEnabled: true,
          createdAt: summary.createdAt,
        }}
      />,
    );
    await screen.findByText("测试画布");
    expect(fetchMock.mock.calls[0][0]).toContain("accountId=user-a");
    fireEvent.click(screen.getByRole("button", { name: "工作流记录" }));
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)?.[0]).toContain("source=workflow"));
    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain("accountId=user-a");
    fireEvent.click(screen.getByRole("button", { name: "清除用户筛选" }));
    fireEvent.change(screen.getByPlaceholderText("按用户昵称、邮箱或用户 ID 筛选"), {
      target: { value: "用户乙" },
    });
    await waitFor(() => {
      const query = new URL(fetchMock.mock.calls.at(-1)![0], "http://localhost").searchParams;
      expect(query.get("search")).toBe("用户乙");
      expect(query.has("accountId")).toBe(false);
      expect(query.get("offset")).toBe("0");
    });
  });

  it("ignores an older list response after the user changes the source", async () => {
    let resolveOld!: (value: Response) => void;
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      url.includes("source=canvas")
        ? new Promise<Response>((resolve) => {
            resolveOld = resolve;
          })
        : Promise.resolve(
            response(page({ ...summary, source: "workflow", projectName: "新筛选记录" })),
          ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<RequestHistoryPanel />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "工作流记录" }));
    await screen.findByText("新筛选记录");
    resolveOld(response(page()));
    await waitFor(() => expect(screen.queryByText("测试画布")).not.toBeInTheDocument());
  });

  it("shows unavailable media and node failures without losing other artifacts", () => {
    const value = detail({
      ...summary,
      source: "workflow",
      kind: "workflow",
      status: "failed",
      error: "运行失败",
    });
    const mediaPath = `/api/v1/admin/requests/workflow/${summary.id}/assets/019aaaaa-0000-7000-8000-000000000002`;
    value.artifacts.push({
      kind: "image",
      text: null,
      assetId: "image",
      url: mediaPath,
      mediaType: "image/png",
      unavailable: false,
    });
    value.artifacts.push({
      kind: "video",
      text: null,
      assetId: "video",
      url: mediaPath,
      mediaType: "video/mp4",
      unavailable: false,
    });
    value.nodes = [
      {
        id: "video-1",
        type: "videoGenerate",
        status: "failed",
        reused: false,
        input: { prompt: "节点输入" },
        artifacts: [],
        error: "上游拒绝",
        startedAt: null,
        finishedAt: null,
      },
    ];
    const view = render(<RequestDetailView detail={value} />);
    expect(screen.getByText("实际文本产物")).toBeInTheDocument();
    expect(view.container.querySelector("video")).toHaveAttribute("controls");
    expect(view.container.querySelector("video")).toHaveAttribute("src", mediaPath);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByText("产物已删除或暂不可用")).toBeInTheDocument();
    expect(screen.getByText("上游拒绝")).toBeInTheDocument();
  });

  it("never embeds supplier URLs or arbitrary relative paths as artifacts", () => {
    expect(artifactUrl("https://supplier.invalid/result.mp4")).toBeNull();
    expect(artifactUrl("//supplier.invalid/result.mp4")).toBeNull();
    expect(artifactUrl("/api/v1/canvas/assets/id")).toBeNull();
    expect(
      artifactUrl(`/api/v1/admin/requests/canvas/${summary.id}/assets/${summary.id}`),
    ).not.toBeNull();
  });

  it("restores server paging and exact filters from the URL", async () => {
    window.history.replaceState(
      null,
      "",
      "/admin/runs?recordSource=workflow&accountId=user-a&status=failed&page=3&size=50",
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ items: [], total: 121, offset: 100, limit: 50 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<RequestHistoryPanel />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const query = new URL(fetchMock.mock.calls[0][0], "http://localhost").searchParams;
    expect(Object.fromEntries(query)).toMatchObject({
      source: "workflow",
      accountId: "user-a",
      status: "failed",
      offset: "100",
      limit: "50",
    });
    expect(await screen.findByText("共 121 条")).toBeVisible();
    expect(window.location.search).not.toContain("prompt");
  });
});
