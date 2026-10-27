"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { adminTabHref, type AdminTab } from "../admin-navigation";
import { workspaceLocation } from "./location";
import { workspaceGuards, type WorkspaceStore } from "./store";
import type { PendingWorkspaceAction } from "./close-dialog";
import type { TabAction } from "./tabs";
import { useWorkspaceHistory } from "./use-workspace-history";

function internalHref(href: string) {
  const url = new URL(href, window.location.href);
  return url.origin === window.location.origin ? url.pathname + url.search + url.hash : null;
}

export function useWorkspaceActions(store: WorkspaceStore, href: string) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingWorkspaceAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const approvedExit = useRef(false);
  const protect = useCallback(
    (keys: string[], title: string, proceed: () => void) => {
      if (workspaceGuards(store, keys).length) setPending({ keys, title, proceed });
      else proceed();
    },
    [store],
  );
  const navigate = useCallback(
    (href: string, replace = false) => {
      const target = new URL(href, window.location.href);
      if (!["http:", "https:"].includes(target.protocol)) return;
      const internal = internalHref(href);
      if (!internal || !workspaceLocation(internal)) {
        protect(
          store.getState().tabs.map((tab) => tab.key),
          "离开管理工作区",
          () => {
            approvedExit.current = true;
            if (internal) router.push(internal);
            else window.location.assign(href);
          },
        );
        return;
      }
      if (!store.getState().visit(internal)) {
        setError("已打开 20 个页签，请先关闭不再使用的页面。");
        return;
      }
      setError(null);
      approvedExit.current = false;
      if (replace) router.replace(internal, { scroll: false });
      else router.push(internal, { scroll: false });
    },
    [store, protect, router],
  );
  function select(key: string) {
    const tab = store.getState().tabs.find((item) => item.key === key);
    if (tab) navigate(tab.href);
  }
  function menu(value: AdminTab) {
    const existing = store.getState().tabs.find((tab) => tab.kind === "menu" && tab.menu === value);
    navigate(existing?.href ?? adminTabHref(value));
  }
  function action(value: TabAction, key: string) {
    const { tabs } = store.getState();
    const index = tabs.findIndex((tab) => tab.key === key);
    if (value === "refresh") {
      protect([key], "刷新页面前处理修改", () => store.getState().refresh(key));
      return;
    }
    const keys = tabs
      .filter((tab, at) => {
        if (tab.pinned) return false;
        if (value === "close") return tab.key === key;
        if (value === "others") return tab.key !== key;
        if (value === "right") return at > index;
        return true;
      })
      .map((tab) => tab.key);
    protect(keys, "关闭页面前处理修改", () => {
      const href = store.getState().remove(keys);
      router.replace(href, { scroll: false });
    });
  }
  useEffect(() => {
    function click(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = internalHref(anchor.href);
      if (!href || anchor.hash) return;
      event.preventDefault();
      navigate(href);
    }
    function unload(event: BeforeUnloadEvent) {
      if (approvedExit.current) return;
      if (
        workspaceGuards(
          store,
          store.getState().tabs.map((tab) => tab.key),
        ).length
      )
        event.preventDefault();
    }
    document.addEventListener("click", click, true);
    window.addEventListener("beforeunload", unload);
    return () => {
      document.removeEventListener("click", click, true);
      window.removeEventListener("beforeunload", unload);
    };
  }, [navigate, store]);
  useWorkspaceHistory(store, href, protect, setError);
  return { navigate, select, menu, action, protect, pending, setPending, error, setError };
}
