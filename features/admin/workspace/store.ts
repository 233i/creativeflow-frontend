import { createStore } from "zustand/vanilla";
import type { WorkspaceGuard, WorkspaceMeta } from "@/components/providers/workspace-context";
import {
  mergeWorkspaceTab,
  persistableTab,
  restoreWorkspace,
  workspaceLocation,
  WORKFLOW_HOME,
  type WorkspaceTab,
} from "./location";

export const MAX_WORKSPACE_TABS = 20;
export const workspaceStorageKey = (accountId: string) =>
  `creativeflow.admin.workspace:${accountId}`;
export const homeTab = () => workspaceLocation(WORKFLOW_HOME)!;

interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeKey: string;
  mounted: string[];
  recent: string[];
  guards: Map<string, Map<string, WorkspaceGuard>>;
  visit: (href: string) => boolean;
  setHref: (key: string, href: string) => void;
  updateMeta: (key: string, meta: WorkspaceMeta) => void;
  registerGuard: (key: string, id: string, guard: WorkspaceGuard) => () => void;
  remove: (keys: string[]) => string;
  reorder: (from: number, to: number) => void;
  refresh: (key: string) => void;
  versions: Record<string, number>;
}

function guardFlags(guards: Map<string, WorkspaceGuard>) {
  return {
    dirty: [...guards.values()].some((guard) => guard.dirty),
    busy: [...guards.values()].some((guard) => guard.busy),
  };
}

/** 仅恢复页签元数据，草稿、凭据和运行结果始终留在各页面实例中。 */
export function createWorkspaceStore(href: string, restored: string | null = null) {
  const current = workspaceLocation(href) ?? homeTab();
  const restoredTabs = restoreWorkspace(restored);
  const savedHome = restoredTabs.find((tab) => tab.pinned) ?? homeTab();
  const tabs = [savedHome, ...restoredTabs.filter((tab) => !tab.pinned)].slice(
    0,
    MAX_WORKSPACE_TABS,
  );
  if (!tabs.some((tab) => tab.key === current.key) && tabs.length === MAX_WORKSPACE_TABS)
    tabs.pop();
  return createStore<WorkspaceState>((set, get) => ({
    tabs: mergeWorkspaceTab(tabs, current),
    activeKey: current.key,
    mounted: [current.key],
    recent: [current.key],
    guards: new Map(),
    versions: {},
    visit: (url) => {
      const next = workspaceLocation(url);
      if (!next) return false;
      const state = get();
      if (
        !state.tabs.some((tab) => tab.key === next.key) &&
        state.tabs.length >= MAX_WORKSPACE_TABS
      )
        return false;
      set({
        tabs: mergeWorkspaceTab(state.tabs, next),
        activeKey: next.key,
        mounted: [...new Set([...state.mounted, next.key])],
        recent: [...state.recent.filter((key) => key !== next.key), next.key],
      });
      return true;
    },
    setHref: (key, href) =>
      set((state) => {
        const target = workspaceLocation(href);
        if (!target || target.key !== key) return state;
        return {
          tabs: state.tabs.map((tab) =>
            tab.key === key ? { ...tab, href, section: target.section } : tab,
          ),
        };
      }),
    updateMeta: (key, meta) =>
      set((state) => {
        const tab = state.tabs.find((item) => item.key === key);
        if (
          !tab ||
          Object.entries(meta).every(([field, value]) => tab[field as keyof WorkspaceTab] === value)
        )
          return state;
        return { tabs: state.tabs.map((item) => (item.key === key ? { ...item, ...meta } : item)) };
      }),
    registerGuard: (key, id, guard) => {
      const entries = get().guards.get(key) ?? new Map<string, WorkspaceGuard>();
      entries.set(id, guard);
      get().guards.set(key, entries);
      const update = () =>
        set((state) => {
          const flags = guardFlags(entries);
          const tab = state.tabs.find((item) => item.key === key);
          if (!tab || (tab.dirty === flags.dirty && tab.busy === flags.busy)) return state;
          return {
            tabs: state.tabs.map((item) => (item.key === key ? { ...item, ...flags } : item)),
          };
        });
      update();
      return () => {
        entries.delete(id);
        update();
      };
    },
    remove: (keys) => {
      const state = get();
      const removed = new Set(keys);
      const remaining = state.tabs.filter((tab) => tab.pinned || !removed.has(tab.key));
      const recent = state.recent.filter((key) => remaining.some((tab) => tab.key === key));
      const activeKey = remaining.some((tab) => tab.key === state.activeKey)
        ? state.activeKey
        : (recent.at(-1) ?? homeTab().key);
      for (const key of removed) state.guards.delete(key);
      set({
        tabs: remaining,
        activeKey,
        recent,
        mounted: [
          ...new Set([
            ...state.mounted.filter((key) => remaining.some((tab) => tab.key === key)),
            activeKey,
          ]),
        ],
        versions: Object.fromEntries(
          Object.entries(state.versions).filter(([key]) =>
            remaining.some((tab) => tab.key === key),
          ),
        ),
      });
      return remaining.find((tab) => tab.key === activeKey)!.href;
    },
    reorder: (from, to) =>
      set((state) => {
        if (from <= 0 || to <= 0 || from >= state.tabs.length || to >= state.tabs.length)
          return state;
        const reordered = [...state.tabs];
        reordered.splice(to, 0, reordered.splice(from, 1)[0]);
        return { tabs: reordered };
      }),
    refresh: (key) =>
      set((state) => ({ versions: { ...state.versions, [key]: (state.versions[key] ?? 0) + 1 } })),
  }));
}

export function persistWorkspace(
  store: ReturnType<typeof createWorkspaceStore>,
  accountId: string,
) {
  try {
    sessionStorage.setItem(
      workspaceStorageKey(accountId),
      JSON.stringify(store.getState().tabs.map(persistableTab)),
    );
  } catch {
    /* 浏览器禁用存储时仍可使用当前工作区。 */
  }
}

export function workspaceGuards(store: ReturnType<typeof createWorkspaceStore>, keys: string[]) {
  return keys
    .flatMap((key) => [...(store.getState().guards.get(key)?.values() ?? [])])
    .filter((guard) => guard.dirty || guard.busy);
}
export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;
