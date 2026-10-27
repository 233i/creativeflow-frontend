"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { workspaceLocation } from "./location";
import { workspaceGuards, MAX_WORKSPACE_TABS, type WorkspaceStore } from "./store";

type Protect = (keys: string[], title: string, proceed: () => void) => void;

/** 浏览器后退切换已打开页面；即将销毁表单或工作区时先处理修改。 */
export function useWorkspaceHistory(
  store: WorkspaceStore,
  href: string,
  protect: Protect,
  onError: (message: string) => void,
) {
  const router = useRouter();
  const previous = useRef<{ href: string; state: unknown }>({ href, state: null });
  useEffect(() => {
    previous.current = { href, state: window.history.state };
  }, [href]);
  useEffect(() => {
    function pop(event: PopStateEvent) {
      const targetHref = window.location.pathname + window.location.search;
      const target = workspaceLocation(targetHref);
      const state = store.getState();
      const current = state.tabs.find((tab) => tab.key === state.activeKey)!;
      const keys = target ? [current.key] : state.tabs.map((tab) => tab.key);
      const guards = workspaceGuards(store, keys);
      const sectionChange = target?.key === current.key && target.section !== current.section;
      const blocked = target
        ? sectionChange && guards.some((guard) => guard.leaveSection)
        : guards.length > 0;
      const full =
        target &&
        !state.tabs.some((tab) => tab.key === target.key) &&
        state.tabs.length >= MAX_WORKSPACE_TABS;
      if (!blocked && !full) return;
      event.stopImmediatePropagation();
      window.history.pushState(previous.current.state, "", previous.current.href);
      if (full) {
        onError("已打开 20 个页签，请先关闭不再使用的页面。");
        return;
      }
      protect(keys, "切换页面前处理修改", () => router.push(targetHref, { scroll: false }));
    }
    window.addEventListener("popstate", pop, true);
    return () => window.removeEventListener("popstate", pop, true);
  }, [store, protect, onError, router]);
}
