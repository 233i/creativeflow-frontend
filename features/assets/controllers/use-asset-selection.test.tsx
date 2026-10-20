import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAssetSelection } from "./use-asset-selection";
import { assetFixture } from "../test-fixtures";

describe("asset selection scope", () => {
  it("does not resurrect a previous selection when returning to an earlier scope", () => {
    const item = assetFixture();
    const { result, rerender } = renderHook(({ scope }) => useAssetSelection(scope, [item]), {
      initialProps: { scope: "mine" },
    });
    act(() => result.current.toggle(item));
    expect(result.current.selectedIds.has(item.id)).toBe(true);
    rerender({ scope: "public" });
    expect(result.current.selected).toHaveLength(0);
    rerender({ scope: "mine" });
    expect(result.current.selected).toHaveLength(0);
  });
  it("uses the current page revision and resets preselection when its owner changes", () => {
    const first = assetFixture();
    const second = assetFixture({ id: "asset-b", url: "/asset-b" });
    const { result, rerender } = renderHook(
      ({ revision, selectedUrl }) =>
        useAssetSelection("page", [{ ...first, revision }, second], { single: true, selectedUrl }),
      { initialProps: { revision: "3", selectedUrl: first.url } },
    );
    act(() => result.current.toggle(second));
    rerender({ revision: "4", selectedUrl: second.url });
    expect(result.current.selected.map((asset) => asset.id)).toEqual([second.id]);
    act(() => result.current.toggle(first));
    expect(result.current.selected[0].revision).toBe("4");
  });
});
