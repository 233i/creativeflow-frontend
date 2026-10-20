import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useCenterQuery } from "../controllers/use-center-query";
import { dateBoundary } from "../query-state";
import { AssetFilters } from "./filters";

const facets = {
  owners: [{ id: "account-1234", name: "测试用户", count: 2 }],
  groups: [{ id: "group-1234", name: "产品素材", count: 3 }],
  tags: ["产品", "封面"],
};

function Harness() {
  const route = useCenterQuery();
  return (
    <>
      <AssetFilters route={route} facets={facets} />
      <output data-testid="query">{JSON.stringify(route.query)}</output>
    </>
  );
}

const params = () => new URLSearchParams(window.location.search);
const query = () => JSON.parse(screen.getByTestId("query").textContent!);
const choose = async (user: ReturnType<typeof userEvent.setup>, label: string, option: string) => {
  await user.click(screen.getByLabelText(label));
  await user.click(await screen.findByText(option, { selector: ".t-select-option span" }));
};

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/admin?tab=assets&assetPage=3");
});

describe("TDesign asset filters", () => {
  it("uses labeled TDesign controls and keeps advanced filters keyboard-accessible", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    expect(container.querySelector("select, input[type=date], datalist")).toBeNull();
    expect(screen.getByLabelText("搜索资产")).toHaveClass("t-input__inner");
    expect(screen.getByLabelText("资产类型")).toHaveClass("t-input__inner");
    const toggle = screen.getByRole("button", { name: "更多筛选" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("创建起始日期")).not.toBeVisible();
    toggle.focus();
    await user.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("创建起始日期")).toBeVisible();
  });

  it("updates type, source, owner and sort without changing other URL state", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await choose(user, "资产类型", "视频");
    await choose(user, "资产来源", "本地上传");
    await choose(user, "资产所有者", "测试用户 · account-");
    await choose(user, "资产排序", "最大文件");
    expect(params().get("assetPage")).toBeNull();
    expect(params().get("tab")).toBe("assets");
    expect(query()).toMatchObject({
      kind: "video",
      source: "upload",
      accountId: "account-1234",
      sort: "size_desc",
      offset: 0,
    });
    await choose(user, "资产类型", "全部类型");
    await choose(user, "资产所有者", "全部用户");
    expect(params().get("kind")).toBeNull();
    expect(params().get("accountId")).toBeNull();
    expect(screen.getByLabelText("资产类型")).toHaveValue("全部类型");
  });

  it("keeps free-text search and tags bounded and supports tag suggestions", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("搜索资产"), { target: { value: "a".repeat(205) } });
    expect(params().get("q")).toHaveLength(200);
    await user.click(screen.getByRole("button", { name: "更多筛选" }));
    await user.click(screen.getByLabelText("标签筛选"));
    await user.click(await screen.findByText("封面"));
    expect(params().get("tag")).toBe("封面");
    await user.clear(screen.getByLabelText("标签筛选"));
    await user.type(screen.getByLabelText("标签筛选"), "新标签");
    expect(params().get("tag")).toBe("新标签");
    fireEvent.change(screen.getByLabelText("标签筛选"), { target: { value: "b".repeat(45) } });
    expect(params().get("tag")).toHaveLength(40);
    await user.clear(screen.getByLabelText("标签筛选"));
    expect(params().get("tag")).toBeNull();
  });

  it("keeps folder and ungrouped mutually exclusive and sends checkbox filters", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "更多筛选" }));
    await choose(user, "资产文件夹", "产品素材 · 3");
    expect(params().get("group")).toBe("group-1234");
    await choose(user, "资产文件夹", "未分组");
    expect(params().get("group")).toBeNull();
    expect(params().get("ungrouped")).toBe("1");
    await choose(user, "资产文件夹", "全部文件夹");
    expect(params().get("ungrouped")).toBeNull();
    await choose(user, "引用筛选", "无引用");
    await user.click(screen.getByRole("checkbox", { name: "≥ 10 MiB" }));
    await user.click(screen.getByRole("checkbox", { name: "仅已清理记录" }));
    expect(query()).toMatchObject({ minBytes: 10485760, state: "purged", usage: "unreferenced" });
    await user.click(screen.getByRole("checkbox", { name: "≥ 10 MiB" }));
    expect(params().get("large")).toBeNull();
  });

  it("preserves independent date bounds and local start/end-of-day query semantics", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "更多筛选" }));
    const start = screen.getByLabelText("创建起始日期");
    const end = screen.getByLabelText("创建截止日期");
    expect(end).not.toHaveAttribute("readonly");
    await user.click(end);
    expect(end).toHaveFocus();
    await user.type(end, "2026-09-29", { skipClick: true });
    expect(end).toHaveValue("2026-09-29");
    await user.keyboard("{Enter}");
    expect(params().get("to")).toBe("2026-09-29");
    expect(params().get("from")).toBeNull();
    expect(query().to).toBe(dateBoundary("2026-09-29", true));
    await user.type(start, "2026-09-01{Enter}");
    expect(params().get("from")).toBe("2026-09-01");
    expect(query().from).toBe(dateBoundary("2026-09-01", false));
    await user.clear(end);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(params().get("to")).toBeNull());
    expect(params().get("from")).toBe("2026-09-01");
  });

  it("restores controls on browser navigation and preserves sort/view/tab when clearing", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "更多筛选" }));
    await user.click(screen.getByRole("button", { name: "列表视图" }));
    act(() => {
      window.history.pushState(
        {},
        "",
        "/admin?tab=assets&assetTab=recycle&kind=video&tag=封面&from=2026-02-30&to=2026-09-29&large=1&sort=size_desc&assetPage=2",
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByLabelText("资产类型")).toHaveValue("视频");
    expect(screen.getByLabelText("标签筛选")).toHaveValue("封面");
    expect(screen.getByLabelText("创建起始日期")).toHaveValue("");
    expect(screen.getByLabelText("创建截止日期")).toHaveValue("2026-09-29");
    expect(query().from).toBeUndefined();
    expect(screen.queryByRole("checkbox", { name: "仅已清理记录" })).not.toBeInTheDocument();
    await choose(user, "引用筛选", "可安全清理");
    expect(query()).toMatchObject({ usage: "purgeable", state: "recycled" });
    await user.click(screen.getByRole("button", { name: "清空筛选" }));
    expect(window.location.search).toBe("?tab=assets&assetTab=recycle&sort=size_desc");
    expect(screen.getByRole("button", { name: "列表视图" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(localStorage.getItem("creativeflow.admin.assetView")).toBe("table");
    expect(screen.getByLabelText("标签筛选")).toHaveValue("");
    expect(screen.getByLabelText("创建截止日期")).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "≥ 10 MiB" })).not.toBeChecked();
  });

  it("commits typed dates on blur, rejects invalid dates and restores previous URL dates", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/admin?tab=assets&from=2026-09-01");
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "更多筛选" }));
    const start = screen.getByLabelText("创建起始日期");
    await user.clear(start);
    await user.type(start, "2026-09-15");
    await user.tab();
    expect(params().get("from")).toBe("2026-09-15");
    await user.clear(start);
    await user.type(start, "2026-02-30{Enter}");
    expect(params().get("from")).toBe("2026-09-15");
    expect(start).toHaveValue("2026-09-15");
    for (const date of ["2026-09-01", "2026-09-15", "2026-09-01"]) {
      act(() => {
        window.history.replaceState({}, "", `/admin?tab=assets&from=${date}`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      expect(start).toHaveValue(date);
    }
  });
});
