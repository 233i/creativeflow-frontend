"use client";
import { useCallback, useEffect, useMemo } from "react";
import { useWorkspaceGuard, useWorkspacePage } from "@/components/providers/workspace-context";
import { isTypedWorkflowGraph } from "@/features/workflow/types";
import { type DetailSection } from "@/features/admin/workflow-center/detail-context";
import { sectionEvent } from "../detail-location";
import { useDetailBrowserGuard } from "./use-detail-browser-guard";
import type { DetailState } from "./use-detail-state";

export function useDetailNavigation(state: DetailState) {
  const workspace = useWorkspacePage();
  const {
    id,
    source,
    router,
    params,
    returnHref,
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
    formCanSave,
    setFormBusy,
    setFormCanSave,
    formSaveRef,
    current,
  } = state;
  const navigateHref = useCallback(
    (href: string) => {
      if (workspace) workspace.navigate(href);
      else {
        window.history.pushState(window.history.state, "", href);
        window.dispatchEvent(new Event(sectionEvent));
        window.dispatchEvent(new Event("creativeflow:admin-query"));
      }
    },
    [workspace],
  );
  const navigate = useCallback(
    (next: DetailSection) => {
      const query = params.toString();
      navigateHref(`/admin/workflows/${encodeURIComponent(id)}/${next}${query ? `?${query}` : ""}`);
    },
    [id, params, navigateHref],
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
      if (workspace) {
        workspace.navigate(url);
        return;
      }
      if (session?.dirty || formDirty || formBusy) setPending(() => () => router.push(url));
      else router.push(url);
    },
    [workspace, session?.dirty, formDirty, formBusy, setPending, router],
  );
  const inspectRun = useCallback(
    (runId: string, nodeId?: string) => {
      const query = new URLSearchParams(params);
      query.set("inspectRun", runId);
      query.delete("runTrigger");
      if (nodeId) query.set("inspectNode", nodeId);
      else query.delete("inspectNode");
      navigateHref(`/admin/workflows/${encodeURIComponent(id)}/runs?${query}`);
    },
    [id, params, navigateHref],
  );
  const context = useMemo(
    () => ({ header, section, returnHref, select, leave, inspectRun, setSession }),
    [header, section, returnHref, select, leave, inspectRun, setSession],
  );
  useDetailBrowserGuard(state, leave, !workspace);

  function saveIsBlocked() {
    return leaving || session?.busy || formBusy || (formDirty && !formSaveRef.current);
  }
  async function saveChanges(): Promise<boolean> {
    if (saveIsBlocked()) return false;
    setLeaving(true);
    try {
      if (formDirty && formSaveRef.current && !(await formSaveRef.current())) return false;
      const settingsSavedGraph = formDirty && source === "workflow" && section === "settings";
      if (session?.dirty && !settingsSavedGraph && !(await session.save())) return false;
      setFormDirty(false);
      return true;
    } finally {
      setLeaving(false);
    }
  }
  async function saveAndProceed() {
    if (!(await saveChanges())) return;
    const next = pending;
    setPending(null);
    next?.();
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
  useWorkspaceGuard({
    dirty: !!session?.dirty || formDirty,
    busy: !!session?.busy || formBusy || leaving,
    leaveSection: formDirty || formBusy,
    discard: () => setFormDirty(false),
    save: !formDirty || formCanSave ? saveChanges : undefined,
    message:
      formDirty && !formCanSave
        ? "请在原页面确认发布或授权参数；关闭将清除未确认输入和一次性凭证。"
        : undefined,
  });
  const updateMeta = workspace?.updateMeta;
  useEffect(() => {
    if (current)
      updateMeta?.({
        title: current.name,
        subtitle: isTypedWorkflowGraph(current.graph) ? "通用编排" : "媒体创作",
        running: session?.running ?? false,
      });
  }, [updateMeta, current, session?.running]);
  return { navigate, select, leave, inspectRun, context, saveAndProceed, registerForm };
}
