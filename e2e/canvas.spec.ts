import { expect, test } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync, crc32 } from "node:zlib";

/**
 * 画布冒烟测试。
 *
 * 这些测试覆盖推动后续工作的回归问题，因此刻意验证行为而非结构：
 * 上传图片能在重新加载后存续，以及画布能在彻底清空 localStorage 后存续；
 * 这两类故障都曾导致用户数据丢失。
 *
 * 与此测试套件其他部分一样，要求 .NET API 在 :5298 运行。
 */

// 与测试套件其他部分不同，此处串行运行。每个测试都驱动同一 API 实例和同一数据库，
// 并发只会增加争用，还会从同一 IP 产生相同指纹信号；这正是 `MaxCoarseFanout` 要拒绝的情况，
// 却不会增加覆盖率。
test.describe.configure({ mode: "serial" });

/** 一个很小的有效 PNG。运行时生成而不提交，防止固定装置漂移。 */
function writePng(): string {
  const chunk = (type: string, data: Buffer) => {
    const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed) >>> 0);
    return Buffer.concat([length, typed, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(8, 0);
  ihdr.writeUInt32BE(8, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  const raw = Buffer.concat(
    Array.from({ length: 8 }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(24, 0x40)])),
  );

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);

  const path = join(mkdtempSync(join(tmpdir(), "sol-e2e-")), "fixture.png");
  writeFileSync(path, png);
  return path;
}

/** 每个测试在使用受保护的画布和设备 API 前都会获得隔离账户。 */
async function establishAccount(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    const registration = await fetch("/api/v1/auth/password/register", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `sol-e2e-${crypto.randomUUID()}@example.com`,
        password: "sol-e2e-password",
        displayName: "Sol E2E",
      }),
    });
    if (!registration.ok) throw new Error(`registration failed: ${registration.status}`);

    const handshake = await fetch("/api/v1/device/handshake", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        v: 1,
        stable: { timeZone: "UTC", platform: "e2e" },
        volatile: {},
        clientStoredId: null,
      }),
    });
    if (!handshake.ok) throw new Error(`handshake failed: ${handshake.status}`);
    localStorage.setItem("sol.device_id", (await handshake.json()).deviceId);
    // 新账号首次打开会带文生图示例；测试编辑行为需要显式创建自己的空画布，
    // 不能依赖旧版首次访问为空的产品行为，也不修改其他测试或用户的画布。
    const canvas = await fetch("/api/v1/canvas", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "E2E empty canvas", graph: { nodes: [], edges: [] } }),
    });
    if (!canvas.ok) throw new Error(`canvas fixture failed: ${canvas.status}`);
    localStorage.setItem("sol.canvas.current", (await canvas.json()).id);
  });
}

/**
 * 等待自动保存到达服务器。
 *
 * 根据保存指示器而非固定延迟判断：并行测试负载下，固定等待要么不稳定，要么无谓地缓慢；
 * 此方式还能同时断言指示器正常工作。
 */
async function waitForSaved(page: import("@playwright/test").Page) {
  await expect(page.getByText("已保存")).toBeVisible({ timeout: 20_000 });
}

/** 通过不受子控件覆盖的节点标题栏打开上下文菜单。 */
async function openNodeMenu(page: import("@playwright/test").Page, index = 0) {
  await page.locator(".react-flow__node header").nth(index).click({ button: "right" });
}

test("the root route renders the canvas directly", async ({ page }) => {
  // 不重定向，路径中也没有标识；"/" 就是画布。
  await establishAccount(page);
  await page.goto("/");

  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 15_000 });
  expect(new URL(page.url()).pathname).toBe("/");
});

test("nodes can be added and connected, and survive a reload", async ({ page }) => {
  await establishAccount(page);
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "文本节点" }).click();
  await page.getByRole("button", { name: "图片生成" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);

  await page.locator("textarea").first().fill("a small red house");
  await waitForSaved(page);
  await page.reload();

  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.locator("textarea").first()).toHaveValue("a small red house");
});

test("an uploaded image survives a reload", async ({ page }) => {
  // 回归问题：上传过去使用对象 URL，持久化后恢复时已经失效，
  // 只留下损坏图片且无法重新上传。
  await establishAccount(page);
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "图片节点" }).click();
  await page.locator('input[type="file"]').first().setInputFiles(writePng());

  const image = page.locator(".react-flow__node img");
  await expect(image).toHaveAttribute("src", /\/api\/v1\/canvas\/assets\//, { timeout: 15_000 });
  await waitForSaved(page);
  await page.reload();

  await expect(image).toHaveAttribute("src", /\/api\/v1\/canvas\/assets\//, { timeout: 15_000 });

  // naturalWidth 为 0 表示图片加载失败，这是旧版损坏节点的症状。
  const broken = await image.evaluate(
    (element) =>
      (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth === 0,
  );
  expect(broken).toBe(false);
});

test("a canvas survives clearing local storage", async ({ page }) => {
  // 画布表存在的原因：接入该表前，清除站点数据会销毁用户创建的所有图。
  await establishAccount(page);
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "文本节点" }).click();
  await page.locator("textarea").first().fill("persisted server-side");
  await waitForSaved(page);

  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.locator("textarea").first()).toHaveValue("persisted server-side", {
    timeout: 15_000,
  });
});

test("a node position is saved only after drag release", async ({ page }) => {
  await establishAccount(page);
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "文本节点" }).click();
  await waitForSaved(page);

  const header = page.locator(".react-flow__node header").first();
  const box = await header.boundingBox();
  expect(box).not.toBeNull();

  const baseline = await page.evaluate(() => {
    const canvasId = localStorage.getItem("sol.canvas.current");
    return {
      canvasId,
      snapshot: canvasId ? localStorage.getItem(`sol.canvas.${canvasId}`) : null,
    };
  });
  expect(baseline.canvasId).not.toBeNull();
  expect(baseline.snapshot).not.toBeNull();

  const saves: Array<{
    graph?: { nodes?: Array<{ id: string; position: { x: number; y: number } }> };
  }> = [];
  page.on("request", (request) => {
    if (
      request.method() === "PUT" &&
      request.url().includes(`/api/v1/canvas/${baseline.canvasId}`)
    ) {
      saves.push(request.postDataJSON());
    }
  });

  // 先启动一次自动保存。开始拖动时必须取消它，同时抑制位置帧。
  await page.locator("textarea").first().fill("saved with the released position");
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 120, box!.y + box!.height / 2 + 80, {
    steps: 10,
  });
  await page.waitForTimeout(700);

  expect(saves).toHaveLength(0);
  expect(
    await page.evaluate(
      (canvasId) => localStorage.getItem(`sol.canvas.${canvasId}`),
      baseline.canvasId,
    ),
  ).toBe(baseline.snapshot);

  await page.mouse.up();
  await expect.poll(() => saves.length, { timeout: 20_000 }).toBe(1);
  await waitForSaved(page);

  const savedSnapshot = await page.evaluate(
    (canvasId) => JSON.parse(localStorage.getItem(`sol.canvas.${canvasId}`) ?? "null"),
    baseline.canvasId,
  );
  const baselineSnapshot = JSON.parse(baseline.snapshot!);
  expect(savedSnapshot.nodes[0].position).not.toEqual(baselineSnapshot.nodes[0].position);
  expect(saves[0].graph?.nodes?.[0].position).toEqual(savedSnapshot.nodes[0].position);
  expect(savedSnapshot.nodes[0].data.text).toBe("saved with the released position");

  await page.waitForTimeout(700);
  expect(saves).toHaveLength(1);
});

test("a node context menu can duplicate and delete", async ({ page }) => {
  await establishAccount(page);
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "文本节点" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);

  await openNodeMenu(page);
  await page.getByText("复制节点").click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);

  await openNodeMenu(page);
  await page.getByText("删除节点").click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
});

test("an edge context menu can delete a connection", async ({ page }) => {
  await establishAccount(page);
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 15_000 });

  const edges = page.locator(".react-flow__edge");
  const initialCount = await edges.count();

  await page.getByRole("button", { name: "工作流模板", exact: true }).click();
  await page.getByRole("button", { name: /^文生图/ }).click();
  await expect(edges).toHaveCount(initialCount + 1);

  // 水平 SVG path 的 bounding box 高度为 0，不能用矩形可见性点击；
  // 按真实曲线中点发出鼠标事件，仍验证浏览器命中与菜单行为。
  await expect
    .poll(
      () =>
        edges
          .last()
          .locator(".react-flow__edge-interaction")
          .evaluate((element) => {
            const path = element as SVGPathElement;
            const point = path.getPointAtLength(path.getTotalLength() / 2);
            const matrix = path.getScreenCTM();
            if (!matrix) return false;
            const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
            return (
              document.elementFromPoint(screen.x, screen.y)?.closest(".react-flow__edge") ===
              path.closest(".react-flow__edge")
            );
          }),
      { timeout: 10000 },
    )
    .toBe(true);
  const midpoint = await edges
    .last()
    .locator(".react-flow__edge-interaction")
    .evaluate((element) => {
      const path = element as SVGPathElement;
      const point = path.getPointAtLength(path.getTotalLength() / 2);
      const matrix = path.getScreenCTM();
      if (!matrix) throw new Error("edge has no screen transform");
      const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
      return { x: screen.x, y: screen.y };
    });
  await page.mouse.click(midpoint.x, midpoint.y, { button: "right" });
  await page.getByText("删除连接", { exact: true }).click();
  await expect(edges).toHaveCount(initialCount);

  await waitForSaved(page);
  await page.reload();
  await expect(edges).toHaveCount(initialCount);
});

test("nodes can be automatically arranged from the canvas toolbar", async ({ page }) => {
  await establishAccount(page);
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "文本节点" }).click();
  await page.getByRole("button", { name: "图片生成" }).click();
  await waitForSaved(page);

  const before = await page.evaluate(() => {
    const canvasId = localStorage.getItem("sol.canvas.current");
    return canvasId ? localStorage.getItem(`sol.canvas.${canvasId}`) : null;
  });
  expect(before).not.toBeNull();

  await page.getByRole("button", { name: "自动排列" }).click();
  await waitForSaved(page);

  const after = await page.evaluate(() => {
    const canvasId = localStorage.getItem("sol.canvas.current");
    return canvasId ? localStorage.getItem(`sol.canvas.${canvasId}`) : null;
  });
  expect(after).not.toBeNull();
  expect(
    JSON.parse(after!).nodes.map((node: { position: { x: number; y: number } }) => node.position),
  ).not.toEqual(
    JSON.parse(before!).nodes.map((node: { position: { x: number; y: number } }) => node.position),
  );
});

test("ordinary settings retain account and extension controls without provider administration", async ({
  page,
}) => {
  // 渠道配置已经迁至独立后台。旧测试假设普通用户还能添加 Anthropic，
  // 会等待一个产品已移除的入口；此处固定现有权限/UI边界，不恢复旧入口。
  await establishAccount(page);
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "设置" }).click();
  const settings = page.getByRole("dialog", { name: "设置", exact: true });
  await expect(settings.getByRole("heading", { name: "通用设置", exact: true })).toBeVisible();
  await expect(settings.getByRole("heading", { name: "设备信息", exact: true })).toBeVisible();
  await expect(settings.getByRole("button", { name: "MCPs 管理", exact: true })).toBeVisible();
  await expect(settings.getByRole("button", { name: "Skills 管理", exact: true })).toBeVisible();
  await expect(settings.getByRole("button", { name: "渠道管理", exact: true })).toHaveCount(0);
});
