import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assetFixture } from "@/features/assets/test-fixtures";
import { AssetLibraryDialog } from "../asset-library-dialog";
import * as library from "@/features/assets/api";
import * as canvas from "../api";

vi.mock("@/components/providers/i18n-provider", () => ({ useT: () => (key: string) => key }));
vi.mock("@/features/assets/api", async (original) => ({
  ...(await original<typeof import("@/features/assets/api")>()),
  listLibraryAssets: vi.fn(),
}));
vi.mock("@/features/canvas/api", async (original) => ({
  ...(await original<typeof import("../api")>()),
  listAssetGroups: vi.fn(),
  createAssetGroup: vi.fn(),
  renameAssetGroup: vi.fn(),
}));

function LibrarySession() {
  const [open, setOpen] = useState(true);
  return open ? <AssetLibraryDialog onOpenChange={setOpen} at={() => ({ x: 0, y: 0 })} /> : null;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(library.listLibraryAssets).mockResolvedValue({
    items: [assetFixture()],
    total: 1,
    offset: 0,
    limit: 60,
  });
  vi.mocked(canvas.listAssetGroups).mockResolvedValue({
    groups: [
      {
        id: "group-a",
        name: "Reference",
        assetCount: 0,
        createdAt: "2026-09-28T00:00:00Z",
        updatedAt: "2026-09-28T00:00:00Z",
      },
    ],
  });
});

describe("asset library keyboard with the real dialog", () => {
  it.each(["canvas.assetGroupCreate", "canvas.assetGroupRename"])(
    "Escape cancels %s locally before a later Escape closes the library",
    async (command) => {
      const user = userEvent.setup();
      render(<LibrarySession />);
      await screen.findByRole("button", { name: "Asset A" });
      await user.click(screen.getByRole("button", { name: command }));
      const input = screen.getByRole("textbox", { name: "canvas.assetGroupNamePlaceholder" });
      await user.clear(input);
      await user.type(input, "Abandoned{Escape}");

      expect(canvas.createAssetGroup).not.toHaveBeenCalled();
      expect(canvas.renameAssetGroup).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog", { name: "canvas.assetLibrary" })).toBeInTheDocument();
      expect(
        screen.queryByRole("textbox", { name: "canvas.assetGroupNamePlaceholder" }),
      ).toBeNull();
      expect(screen.getByRole("button", { name: /Reference/ })).toBeInTheDocument();

      await user.click(screen.getByRole("textbox", { name: "搜索素材" }));
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    },
  );
});
