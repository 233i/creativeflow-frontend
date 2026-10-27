"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { WorkflowDocument } from "@/features/workflow/api";
import type { WorkflowGraph } from "@/features/workflow/types";
import { useWorkspacePage, useWorkspaceActive } from "@/components/providers/workspace-context";

export type EditorSection = "edit" | "publications" | "runs" | "access" | "settings";

export interface EditorSession {
  document: WorkflowDocument;
  graph: WorkflowGraph;
  dirty: boolean;
  busy: boolean;
  running?: boolean;
  save: (name?: string) => Promise<boolean>;
}

interface DetailContext {
  header: HTMLElement | null;
  section: EditorSection;
  returnHref: string;
  select: (section: EditorSection) => void;
  leave: (url: string) => void;
  inspectRun: (runId: string, nodeId?: string) => void;
  setSession: (session: EditorSession | null) => void;
}

export const WorkflowDetailContext = createContext<DetailContext | null>(null);
export function useWorkflowDetail() {
  return useContext(WorkflowDetailContext);
}

export function useWorkflowCanvasActive() {
  const active = useWorkspaceActive();
  const detail = useWorkflowDetail();
  return active && (!detail || detail.section === "edit");
}

/** 只转交编辑器状态与原保存动作；页签切换不保存、不重新挂载图。 */
export function useEditorSession(
  document: WorkflowDocument | null,
  graph: WorkflowGraph,
  dirty: boolean,
  busy: boolean,
  save: EditorSession["save"],
  running = false,
) {
  useEditorLeaveGuard(dirty);
  const detail = useWorkflowDetail();
  const register = detail?.setSession;
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    if (!register || !document) return;
    register({ document, graph, dirty, busy, running, save: (name) => saveRef.current(name) });
  }, [register, document, graph, dirty, busy, running]);
  useEffect(
    () => () => {
      register?.(null);
    },
    [register],
  );
}

/** 新管理框架中头部固定到页签上方；旧路由继续原位渲染。 */
export function WorkflowDetailHeader({ children }: { children: ReactNode }) {
  const detail = useWorkflowDetail();
  if (!detail) return children;
  return detail.header && detail.section === "edit" ? createPortal(children, detail.header) : null;
}

/** Both editor types use the same browser leave guard; navigation stays with the host. */
export function useEditorLeaveGuard(dirty: boolean) {
  const workspace = useWorkspacePage();
  useEffect(() => {
    if (!dirty || workspace) return;
    const confirmLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", confirmLeave);
    return () => window.removeEventListener("beforeunload", confirmLeave);
  }, [dirty, workspace]);
}
