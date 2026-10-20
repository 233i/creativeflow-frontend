import { describe, expect, it } from "vitest";
import { dateBoundary, readAssetCenterQuery } from "./query-state";

describe("asset URL query", () => {
  it("restores scope, paging and all filters without adding the detail ID to selection scope", () => {
    const params = new URLSearchParams(
      "assetTab=public&assetPage=3&q=poster&kind=image&source=upload&group=g&tag=t&accountId=owner&usage=referenced&large=1&sort=size_desc&from=2026-09-01&to=2026-09-28&asset=detail",
    );
    const parsed = readAssetCenterQuery(params);
    expect(parsed.query).toEqual({
      search: "poster",
      kind: "image",
      source: "upload",
      groupId: "g",
      tag: "t",
      accountId: "owner",
      ungrouped: false,
      usage: "referenced",
      minBytes: 10485760,
      sort: "size_desc",
      from: new Date("2026-09-01T00:00:00").toISOString(),
      to: new Date("2026-09-28T23:59:59.999").toISOString(),
      state: "active",
      public: true,
      offset: 60,
      limit: 30,
    });
    params.set("asset", "another-detail");
    expect(readAssetCenterQuery(params).key).toBe(parsed.key);
  });
  it("keeps public, recycle and purged filters mutually consistent", () => {
    expect(
      readAssetCenterQuery(new URLSearchParams("assetTab=public&purged=1")).query,
    ).toMatchObject({ public: true, state: "active" });
    expect(
      readAssetCenterQuery(new URLSearchParams("assetTab=recycle&purged=1")).query,
    ).toMatchObject({ public: false, state: "recycled" });
    expect(readAssetCenterQuery(new URLSearchParams("purged=1")).query).toMatchObject({
      public: false,
      state: "purged",
    });
  });
  it("bounds malformed page numbers and rejects invalid calendar dates", () => {
    expect(
      readAssetCenterQuery(new URLSearchParams("assetPage=-3&assetTab=invalid")).pageNumber,
    ).toBe(1);
    expect(readAssetCenterQuery(new URLSearchParams("assetPage=100001")).pageNumber).toBe(100000);
    expect(dateBoundary("2026-02-30", false)).toBeUndefined();
    expect(dateBoundary("2026-02-29", true)).toBeUndefined();
    expect(dateBoundary("not-a-date", true)).toBeUndefined();
    expect(dateBoundary("2024-02-29", false)).toBe(new Date("2024-02-29T00:00:00").toISOString());
  });
});
