"use client";
import { type DetailSection } from "@/features/admin/workflow-center/detail-context";
import { useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { sectionEvent } from "../detail-location";
import type { DetailState } from "./use-detail-state";
export function useDetailNavigation(state: DetailState) {
  const {
    id,
    source,
    router,
    params,
    returnHref,
    path,
    section,
    session,
    setSession,
    header,
    pending,
    setPending,
    leaving,
    setLeaving,
    formDirty,
    setFormDirty,
    formBusy,
    setFormBusy,
    setFormCanSave,
    formSaveRef,
    locationBeforePopRef,
    navigationGuardRef,
  } = state;
  const navigate = useCallback(
    (next: DetailSection) => {
      const url = `/admin/workflows/${encodeURIComponent(id)}/${next}${window.location.search}`;
      window.history.pushState(window.history.state, "", url);
      window.dispatchEvent(new Event(sectionEvent));
    },
    [id],
  );
  const select = useCallback(
    (next: DetailSection) => {
      if (next === section) return;
      if (formDirty || formBusy) setPending(() => () => navigate(next));
      else navigate(next);
    },
    [section, formDirty, formBusy, setPending, navigate],
  );
  const leave = useCallback(
    (url: string) => {
      if (session?.dirty || formDirty || formBusy) setPending(() => () => router.push(url));
      else router.push(url);
    },
    [session?.dirty, formDirty, formBusy, setPending, router],
  );
  const inspectRun = useCallback(
    (runId: string, nodeId?: string) => {
      const query = new URLSearchParams(window.location.search);
      query.set("inspectRun", runId);
      query.delete("runTrigger");
      if (nodeId) query.set("inspectNode", nodeId);
      else query.delete("inspectNode");
      window.history.pushState(
        window.history.state,
        "",
        `/admin/workflows/${encodeURIComponent(id)}/runs?${query}`,
      );
      window.dispatchEvent(new Event(sectionEvent));
      window.dispatchEvent(new Event("creativeflow:admin-query"));
    },
    [id],
  );
  const context = useMemo(
    () => ({ header, section, returnHref, select, leave, inspectRun, setSession }),
    [header, section, returnHref, select, leave, inspectRun, setSession],
  );

  useEffect(() => {
    locationBeforePopRef.current = {
      url: window.location.pathname + window.location.search,
      state: window.history.state,
    };
  }, [path, params, locationBeforePopRef]);
  useLayoutEffect(() => {
    navigationGuardRef.current = { formDirty, formBusy, editorDirty: !!session?.dirty };
  }, [formDirty, formBusy, session?.dirty, navigationGuardRef]);
  useLayoutEffect(() => {
    function pop(event: PopStateEvent) {
      const previous = locationBeforePopRef.current;
      if (!previous) return;
      const guard = navigationGuardRef.current;
      const target = window.location.pathname + window.location.search;
      const sameWorkflow =
        window.location.pathname.startsWith(`/admin/workflows/${id}/`) &&
        (new URLSearchParams(window.location.search).get("source") ?? "workflow") === source;
      if (!guard.formDirty && !guard.formBusy && (!guard.editorDirty || sameWorkflow)) return;
      // popstate 不可取消；在 Next 路由处理前恢复当前可写视图，待明确选择后再导航。
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
  }, [id, source, router, locationBeforePopRef, navigationGuardRef, setPending]);

  useEffect(() => {
    if (!session?.dirty && !formDirty && !formBusy) return;
    function unload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    function anchor(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
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
    window.document.addEventListener("click", anchor, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.document.removeEventListener("click", anchor, true);
    };
  }, [session?.dirty, formDirty, formBusy, leave]);

  function saveIsBlocked() {
    return leaving || session?.busy || formBusy || (formDirty && !formSaveRef.current);
  }
  async function saveAndProceed() {
    if (saveIsBlocked()) return;
    setLeaving(true);
    try {
      if (formDirty && formSaveRef.current && !(await formSaveRef.current())) return;
      if (
        session?.dirty &&
        !(formDirty && source === "workflow" && section === "settings") &&
        !(await session.save())
      )
        return;
      setFormDirty(false);
      const next = pending;
      setPending(null);
      next?.();
    } finally {
      setLeaving(false);
    }
  }
  const registerForm = useCallback(
    (dirty: boolean, save: (() => Promise<boolean>) | null, busy = false) => {
      setFormDirty(dirty);
      setFormBusy(busy);
      setFormCanSave(!!save);
      formSaveRef.current = save;
    },
    [formSaveRef, setFormBusy, setFormCanSave, setFormDirty],
  );

  return { navigate, select, leave, inspectRun, context, saveAndProceed, registerForm };
}
