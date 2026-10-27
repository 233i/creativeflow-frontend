import { adminTabLabel, parseAdminTab, type AdminTab } from "../admin-navigation";
import { DETAIL_SECTIONS, type DetailSection } from "../workflow-center/detail-sections";

export interface WorkspaceTab {
  key: string;
  href: string;
  title: string;
  menu: AdminTab;
  kind: "menu" | "workflow";
  id?: string;
  source?: "workflow" | "template";
  section?: DetailSection;
  pinned: boolean;
  dirty?: boolean;
  busy?: boolean;
  running?: boolean;
  subtitle?: string;
}

export const WORKFLOW_HOME = "/admin/workflows";
const identifier = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const persistedParams = new Set([
  "tab",
  "source",
  "q",
  "kind",
  "view",
  "id",
  "api",
  "template",
  "from",
  "to",
  "sort",
  "page",
  "size",
  "accountId",
  "status",
  "type",
  "search",
  "limit",
  "offset",
  "category",
  "assetTab",
  "assetPage",
  "group",
  "ungrouped",
  "tag",
  "usage",
  "large",
  "purged",
  "recordSource",
]);

/** 页面身份与筛选、详情子页分离，同一工作流只打开一个工作区。 */
export function workspaceLocation(href: string): WorkspaceTab | null {
  let url: URL;
  try {
    url = new URL(href, "http://workspace.local");
  } catch {
    return null;
  }
  if (url.origin !== "http://workspace.local") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "admin") return null;
  if (parts[1] === "workflows" && parts.length >= 3) return workflowLocation(url, parts);
  return menuLocation(url, parts);
}

function workflowLocation(url: URL, parts: string[]): WorkspaceTab | null {
  const normalized = url.pathname + url.search;
  const source = url.searchParams.get("source") ?? "workflow";
  const section = parts[3] ?? "edit";
  if (!identifier.test(parts[2]) || parts.length > 4 || !["workflow", "template"].includes(source))
    return null;
  if (!DETAIL_SECTIONS.some((item) => item.id === section)) return null;
  return {
    key: `workflow:${source}:${parts[2].toLowerCase()}`,
    href: normalized,
    title: source === "template" ? "工作流模板" : "工作流详情",
    menu: "workflows",
    kind: "workflow",
    id: parts[2],
    source: source as "workflow" | "template",
    section: section as DetailSection,
    pinned: false,
  };
}

function menuLocation(url: URL, parts: string[]): WorkspaceTab | null {
  const normalized = url.pathname + url.search;
  let menu: AdminTab;
  if (parts.length === 1) menu = parseAdminTab(url.searchParams.get("tab"));
  else if (parts.length === 2 && parts[1] === "workflows") menu = "workflows";
  else if (parts.length === 2 && parts[1] === "runs") menu = "requests";
  else return null;
  if (menu === "workflowApis") menu = "workflows";
  return {
    key: `menu:${menu}`,
    href: normalized,
    title: adminTabLabel(menu),
    menu,
    kind: "menu",
    pinned: menu === "workflows",
  };
}

export function persistableTab(tab: WorkspaceTab): {
  href: string;
  title: string;
  subtitle?: string;
} {
  const url = new URL(tab.href, "http://workspace.local");
  for (const key of [...url.searchParams.keys()])
    if (!persistedParams.has(key)) url.searchParams.delete(key);
  return {
    href: url.pathname + url.search,
    title: tab.title.slice(0, 200),
    subtitle: tab.subtitle?.slice(0, 80),
  };
}

export function restoreWorkspace(value: string | null): WorkspaceTab[] {
  try {
    const saved: unknown = JSON.parse(value ?? "[]");
    if (!Array.isArray(saved)) return [];
    const tabs = saved.slice(0, 30).flatMap((entry) => {
      const tab = typeof entry?.href === "string" ? workspaceLocation(entry.href) : null;
      if (!tab) return [];
      if (typeof entry.title === "string") tab.title = entry.title.slice(0, 200);
      if (typeof entry.subtitle === "string") tab.subtitle = entry.subtitle.slice(0, 80);
      return [tab];
    });
    return [...new Map(tabs.map((tab) => [tab.key, tab])).values()];
  } catch {
    return [];
  }
}

export function mergeWorkspaceTab(tabs: WorkspaceTab[], next: WorkspaceTab): WorkspaceTab[] {
  if (!tabs.some((tab) => tab.key === next.key)) return [...tabs, next];
  return tabs.map((tab) =>
    tab.key === next.key ? { ...tab, href: next.href, section: next.section } : tab,
  );
}
