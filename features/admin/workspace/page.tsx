"use client";

import { useCallback, useMemo } from "react";
import {
  WorkspacePageContext,
  type WorkspaceGuard,
  type WorkspaceMeta,
} from "@/components/providers/workspace-context";
import dynamic from "next/dynamic";
import type { WorkspaceTab } from "./location";
import type { WorkspaceStore } from "./store";

const AdminConsole = dynamic(() =>
  import("../admin-console").then((module) => module.AdminConsole),
);
const WorkflowDetailPage = dynamic(() =>
  import("../workflow-center/detail-page").then((module) => module.WorkflowDetailPage),
);

export function AdminWorkspacePage({
  tab,
  active,
  store,
  navigate,
}: {
  tab: WorkspaceTab;
  active: boolean;
  store: WorkspaceStore;
  navigate: (href: string, replace?: boolean) => void;
}) {
  const updateMeta = useCallback(
    (meta: WorkspaceMeta) => store.getState().updateMeta(tab.key, meta),
    [store, tab.key],
  );
  const registerGuard = useCallback(
    (id: string, guard: WorkspaceGuard) => store.getState().registerGuard(tab.key, id, guard),
    [store, tab.key],
  );
  const context = useMemo(
    () => ({
      key: tab.key,
      href: tab.href,
      active,
      navigate,
      updateMeta,
      registerGuard,
      updateLocation: (href: string, push = false) => {
        if (active) navigate(href, !push);
        else store.getState().setHref(tab.key, href);
      },
    }),
    [tab.key, tab.href, active, navigate, updateMeta, registerGuard, store],
  );
  return (
    <WorkspacePageContext.Provider value={context}>
      <div
        className={`admin-workspace-pane ${tab.kind === "workflow" ? "is-editor" : "is-management"}`}
        hidden={!active}
        id={`workspace-pane-${tab.key.replaceAll(":", "-")}`}
        role="tabpanel"
        aria-label={tab.title}
        inert={!active}
        aria-hidden={!active}
        data-workspace-key={tab.key}
      >
        {tab.kind === "workflow" ? (
          <WorkflowDetailPage id={tab.id!} source={tab.source!} initialSection={tab.section!} />
        ) : (
          <AdminConsole initialTab={tab.menu} />
        )}
      </div>
    </WorkspacePageContext.Provider>
  );
}
