import type { AssetQuery } from "@/features/assets/types";

export type AssetTab = "all" | "public" | "recycle" | "storage";
export type AssetFilterPatch = Record<string, string | null>;
export const ASSET_PAGE_SIZE = 30;
const filterKeys = [
  "q",
  "kind",
  "source",
  "group",
  "ungrouped",
  "tag",
  "usage",
  "from",
  "to",
  "large",
  "purged",
  "accountId",
];
export const clearedAssetFilters = (): AssetFilterPatch =>
  Object.fromEntries(filterKeys.map((key) => [key, null]));

/** Dates use the same local timezone as the UI; invalid URL values stay out of requests. */
export function dateBoundary(value: string | null, end: boolean): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00"}`);
  const [year, month, day] = value.split("-").map(Number);
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day)
    return undefined;
  return date.toISOString();
}

function assetState(params: URLSearchParams, tab: AssetTab) {
  if (tab === "recycle") return "recycled";
  return params.get("purged") === "1" && tab === "all" ? "purged" : "active";
}

export function readAssetCenterQuery(params: URLSearchParams) {
  const requestedTab = params.get("assetTab");
  const tab: AssetTab =
    requestedTab === "public" || requestedTab === "recycle" || requestedTab === "storage"
      ? requestedTab
      : "all";
  const pageNumber = Math.max(
    1,
    Math.min(100000, Number.parseInt(params.get("assetPage") ?? "1", 10) || 1),
  );
  const query: AssetQuery = {
    search: params.get("q") ?? "",
    kind: params.get("kind") ?? "",
    source: params.get("source") ?? "",
    groupId: params.get("group") || undefined,
    ungrouped: params.get("ungrouped") === "1",
    tag: params.get("tag") ?? "",
    accountId: params.get("accountId") || undefined,
    from: dateBoundary(params.get("from"), false),
    to: dateBoundary(params.get("to"), true),
    usage: params.get("usage") ?? "",
    minBytes: params.get("large") === "1" ? 10 * 1024 * 1024 : undefined,
    state: assetState(params, tab),
    public: tab === "public",
    sort: params.get("sort") ?? "created_desc",
    offset: (pageNumber - 1) * ASSET_PAGE_SIZE,
    limit: ASSET_PAGE_SIZE,
  };
  return { tab, pageNumber, query, key: `${tab}:${JSON.stringify(query)}` };
}
