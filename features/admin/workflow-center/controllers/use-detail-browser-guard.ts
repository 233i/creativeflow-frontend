"use client";
import { useEffect, useLayoutEffect } from "react";
import { sectionEvent } from "../detail-location";
import type { DetailState } from "./use-detail-state";

/** 独立使用详情组件时保留离开保护；工作区由外壳统一管理。 */
export function useDetailBrowserGuard(
  state: DetailState,
  leave: (href: string) => void,
  enabled: boolean,
) {
  const {
    id,
    source,
    path,
    params,
    router,
    session,
    formDirty,
    formBusy,
    setPending,
    locationBeforePopRef,
    navigationGuardRef,
  } = state;
  useEffect(() => {
    if (!enabled) return;
    locationBeforePopRef.current = {
      url: window.location.pathname + window.location.search,
      state: window.history.state,
    };
  }, [enabled, path, params, locationBeforePopRef]);
  useLayoutEffect(() => {
    navigationGuardRef.current = { formDirty, formBusy, editorDirty: !!session?.dirty };
  }, [formDirty, formBusy, session?.dirty, navigationGuardRef]);
  useLayoutEffect(() => {
    if (!enabled) return;
    function pop(event: PopStateEvent) {
      const previous = locationBeforePopRef.current;
      if (!previous) return;
      const guard = navigationGuardRef.current;
      const target = window.location.pathname + window.location.search;
      const sameWorkflow =
        window.location.pathname.startsWith(`/admin/workflows/${id}/`) &&
        (new URLSearchParams(window.location.search).get("source") ?? "workflow") === source;
      if (!guard.formDirty && !guard.formBusy && (!guard.editorDirty || sameWorkflow)) return;
      event.stopImmediatePropagation();
      window.history.pushState(previous.state, "", previous.url);
      setPending(() => () => {
        if (sameWorkflow) {
          window.history.pushState(window.history.state, "", target);
          window.dispatchEvent(new Event(sectionEvent));
          window.dispatchEvent(new Event("creativeflow:admin-query"));
        } else router.push(target);
      });
    }
    window.addEventListener("popstate", pop, true);
    return () => window.removeEventListener("popstate", pop, true);
  }, [enabled, id, source, router, locationBeforePopRef, navigationGuardRef, setPending]);
  useEffect(() => {
    if (!enabled || (!session?.dirty && !formDirty && !formBusy)) return;
    const unload = (event: BeforeUnloadEvent) => event.preventDefault();
    function anchor(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (
        !link ||
        link.target === "_blank" ||
        link.hasAttribute("download") ||
        (link.hash && link.pathname === location.pathname)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      leave(link.href);
    }
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", anchor, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", anchor, true);
    };
  }, [enabled, session?.dirty, formDirty, formBusy, leave]);
}
