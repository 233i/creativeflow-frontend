import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { AssetStorage } from "@/features/assets/api";

vi.mock("@/features/assets/api", async (original) => ({
  ...(await original<typeof import("@/features/assets/api")>()),
  assetStorage: vi.fn(),
  setAssetPolicy: vi.fn(),
}));

const api = await import("@/features/assets/api");
const { AssetStoragePanel } = await import("./storage");

it("describes persisted file bytes without claiming database or total disk usage", async () => {
  const data: AssetStorage = {
    activeBytes: 1024,
    recycleBytes: 0,
    storedBytes: 512,
    previewBytes: 0,
    purgeableBytes: 0,
    purgedBytes: 0,
    byKind: [],
    byOwner: [],
    bySource: [],
    warning: false,
    policy: { retentionDays: 7, warningBytes: 10737418240, accountWarningBytes: 2147483648 },
  };
  vi.mocked(api.assetStorage).mockResolvedValue(data);
  render(<AssetStoragePanel refresh={0} onClean={vi.fn()} />);
  expect(await screen.findByText("已登记文件与预览（去重）")).toBeInTheDocument();
  expect(screen.queryByText("数据库原件与预览（去重）")).not.toBeInTheDocument();
  expect(screen.getByText(/数据库只保存元数据/)).toHaveTextContent("不含临时写入、Skill 包、备份");
  expect(api.setAssetPolicy).not.toHaveBeenCalled();
});
