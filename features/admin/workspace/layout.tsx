"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useStore } from "zustand";
import { Alert, Button, Loading } from "tdesign-react";
import { AdminLogin } from "../admin-login";
import { AdminShell } from "../admin-shell";
import * as api from "../api";
import { AdminSessionContext, useAdminSession } from "./session";
import { AdminWorkspacePage } from "./page";
import { WorkspaceTabs } from "./tabs";
import { WorkspaceCloseDialog } from "./close-dialog";
import { createWorkspaceStore, persistWorkspace, workspaceStorageKey } from "./store";
import { useWorkspaceActions } from "./use-workspace-actions";
import { workspaceLocation } from "./location";

function readSaved(accountId: string) {
  try {
    return sessionStorage.getItem(workspaceStorageKey(accountId));
  } catch {
    return null;
  }
}

function AuthenticatedWorkspace({
  identity,
  onLogout,
}: {
  identity: api.AdminIdentity;
  onLogout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const query = useSearchParams();
  const href = pathname + (query.size ? `?${query}` : "");
  const [store] = useState(() => createWorkspaceStore(href, readSaved(identity.id)));
  const state = useStore(store);
  const actions = useWorkspaceActions(store, href);
  const active = state.tabs.find((tab) => tab.key === state.activeKey)!;
  useEffect(() => {
    if (workspaceLocation(href)) store.getState().visit(href);
  }, [href, store]);
  useEffect(() => {
    persistWorkspace(store, identity.id);
    return store.subscribe(() => persistWorkspace(store, identity.id));
  }, [store, identity.id]);
  useEffect(() => {
    document.title = `${active.title} · CreativeFlow`;
  }, [active.title, href]);
  function logout() {
    actions.protect(
      state.tabs.map((tab) => tab.key),
      "退出前处理修改",
      () => {
        void onLogout().catch((reason) =>
          actions.setError(reason instanceof Error ? reason.message : "退出失败，请重试。"),
        );
      },
    );
  }
  return (
    <AdminShell
      activeTab={active.menu}
      username={identity.username}
      workspace
      breadcrumb={<span className="truncate">{active.title}</span>}
      onTabChange={actions.menu}
      onLogout={logout}
      notice={
        identity.mustChangePassword && (
          <Alert
            className="sol-admin-notice"
            theme="warning"
            title="当前仍在使用初始密码"
            message="请修改管理员密码。"
            closeBtn={false}
            operation={
              <Button size="small" variant="text" onClick={() => actions.menu("password")}>
                立即修改
              </Button>
            }
          />
        )
      }
    >
      <div className="admin-workspace" data-testid="admin-workspace">
        <WorkspaceTabs
          tabs={state.tabs}
          activeKey={state.activeKey}
          onSelect={actions.select}
          onAction={actions.action}
          onReorder={state.reorder}
        />
        {actions.error && (
          <Alert
            theme="warning"
            message={actions.error}
            closeBtn
            onClose={() => actions.setError(null)}
          />
        )}
        <div className="admin-workspace-pages">
          {state.tabs
            .filter((tab) => state.mounted.includes(tab.key))
            .map((tab) => (
              <AdminWorkspacePage
                key={`${tab.key}:${state.versions[tab.key] ?? 0}`}
                tab={tab}
                active={tab.key === state.activeKey}
                store={store}
                navigate={actions.navigate}
              />
            ))}
        </div>
      </div>
      <WorkspaceCloseDialog
        key={actions.pending?.keys.join(",") ?? "closed"}
        pending={actions.pending}
        store={store}
        onCancel={() => actions.setPending(null)}
      />
    </AdminShell>
  );
}

function WorkspaceSession({ children }: { children: ReactNode }) {
  const session = useAdminSession();
  const accountId = session.identity?.id;
  const previousAccount = useRef(accountId);
  useEffect(() => {
    const previous = previousAccount.current;
    previousAccount.current = accountId;
    if (previous && previous !== accountId) {
      try {
        sessionStorage.removeItem(workspaceStorageKey(previous));
      } catch {
        /* 存储不可用。 */
      }
    }
  }, [accountId]);
  async function logout() {
    await api.logout();
    session.setIdentity(null);
  }
  let content: ReactNode;
  if (session.checking)
    content = (
      <div className="sol-admin-login">
        <Loading text="正在验证管理员身份…" />
      </div>
    );
  else if (!session.identity) content = <AdminLogin onAuthenticated={session.setIdentity} />;
  else
    content = (
      <AuthenticatedWorkspace
        key={session.identity.id}
        identity={session.identity}
        onLogout={logout}
      />
    );
  return (
    <AdminSessionContext.Provider value={session}>
      {children}
      {content}
    </AdminSessionContext.Provider>
  );
}

export function AdminWorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="sol-admin-login">
          <Loading text="正在打开管理工作区…" />
        </div>
      }
    >
      <AdminWorkspaceRoute>{children}</AdminWorkspaceRoute>
    </Suspense>
  );
}

function AdminWorkspaceRoute({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const query = useSearchParams();
  if (!workspaceLocation(pathname + (query.size ? `?${query}` : ""))) return children;
  return <WorkspaceSession>{children}</WorkspaceSession>;
}
