"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useRouter } from "next/navigation";

export interface WorkspaceGuard {
  dirty: boolean;
  busy?: boolean;
  save?: () => Promise<boolean>;
  discard?: () => void;
  message?: string;
  leaveSection?: boolean;
}

export interface WorkspaceMeta {
  title?: string;
  subtitle?: string;
  running?: boolean;
}

export interface WorkspacePage {
  key: string;
  href: string;
  active: boolean;
  navigate: (href: string, replace?: boolean) => void;
  updateLocation: (href: string, push?: boolean) => void;
  updateMeta: (meta: WorkspaceMeta) => void;
  registerGuard: (id: string, guard: WorkspaceGuard) => () => void;
}

export const WorkspacePageContext = createContext<WorkspacePage | null>(null);
export function useWorkspacePage() {
  return useContext(WorkspacePageContext);
}

export function useWorkspaceActive() {
  return useWorkspacePage()?.active ?? true;
}

export function useWorkspaceElementId(id: string) {
  const page = useWorkspacePage();
  return page ? `${id}--${page.key.replaceAll(":", "-")}` : id;
}

/** 工作区内所有业务跳转经过页签管理，独立页面沿用 Next 路由。 */
export function useWorkspaceRouter(): ReturnType<typeof useRouter> {
  const router = useRouter();
  const navigate = useWorkspacePage()?.navigate;
  return useMemo(
    () =>
      navigate
        ? {
            ...router,
            push: (href: string) => navigate(href),
            replace: (href: string) => navigate(href, true),
          }
        : router,
    [router, navigate],
  );
}

/** 保存动作取最新闭包；页签管理只持有状态标记和动作，不复制表单或密钥。 */
export function useWorkspaceGuard(guard: WorkspaceGuard) {
  const page = useWorkspacePage();
  const id = useId();
  const latest = useRef(guard);
  useLayoutEffect(() => {
    latest.current = guard;
  });
  const register = page?.registerGuard;
  const canSave = !!guard.save;
  useEffect(() => {
    if (!register) return;
    return register(id, {
      dirty: guard.dirty,
      busy: guard.busy,
      message: guard.message,
      leaveSection: guard.leaveSection,
      save: canSave ? () => latest.current.save!() : undefined,
      discard: () => latest.current.discard?.(),
    });
  }, [register, id, guard.dirty, guard.busy, guard.message, guard.leaveSection, canSave]);
}
