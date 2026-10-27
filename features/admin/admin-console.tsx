"use client";
import { useState } from "react";
import { useWorkspaceRouter as useRouter } from "@/components/providers/workspace-context";
import { Alert, Button, Loading } from "tdesign-react";
import { useWorkspacePage } from "@/components/providers/workspace-context";
import { useAiStore } from "@/features/ai/store";
import { AdminLogin } from "./admin-login";
import { adminTabHref, type AdminTab } from "./admin-navigation";
import { AdminShell } from "./admin-shell";
import * as adminApi from "./api";
import { AdminPanelContent } from "./workspace/panel-content";
import { useAdminSession } from "./workspace/session";

export function AdminConsole({ initialTab: tab = "workflows" }: { initialTab?: AdminTab }) {
  const router = useRouter();
  const page = useWorkspacePage();
  const { identity: admin, setIdentity: setAdmin, checking } = useAdminSession();
  const [shellError, setShellError] = useState<string | null>(null);
  const refreshAdmin = useAiStore((state) => state.refreshAdmin);
  const aiError = useAiStore((state) => state.error);
  function navigate(href: string) {
    if (page) page.navigate(href);
    else router.push(href);
  }
  function setTab(value: AdminTab) {
    navigate(adminTabHref(value));
  }
  if (checking)
    return (
      <div className="sol-admin-login">
        <Loading size="small" text="正在验证管理员身份…" />
      </div>
    );
  if (!admin) return <AdminLogin onAuthenticated={setAdmin} />;
  async function logout() {
    try {
      await adminApi.logout();
    } finally {
      setAdmin(null);
    }
  }
  const configurationError = [
    "knowledge",
    "providers",
    "models",
    "modelConfig",
    "imageSettings",
  ].includes(tab)
    ? (shellError ?? aiError)
    : null;
  return (
    <AdminShell
      activeTab={tab}
      username={admin.username}
      onTabChange={setTab}
      onLogout={() => void logout()}
      notice={
        admin.mustChangePassword && (
          <Alert
            className="sol-admin-notice"
            theme="warning"
            title="当前仍在使用初始密码"
            message="请尽快修改管理员密码，避免管理权限暴露。"
            closeBtn={false}
            operation={
              <Button size="small" variant="text" onClick={() => setTab("password")}>
                立即修改
              </Button>
            }
          />
        )
      }
    >
      <section className="sol-admin-surface">
        {configurationError && (
          <Alert
            className="sol-admin-error"
            theme="error"
            message={configurationError}
            operation={
              <Button
                size="small"
                variant="text"
                onClick={() => {
                  setShellError(null);
                  void refreshAdmin().catch((reason: unknown) =>
                    setShellError(reason instanceof Error ? reason.message : "加载失败"),
                  );
                }}
              >
                重试
              </Button>
            }
          />
        )}
        <div className="sol-admin-config-panel">
          <AdminPanelContent
            tab={tab}
            username={admin.username}
            onViewRequests={(user) =>
              navigate(`/admin/runs?${new URLSearchParams({ accountId: user.id })}`)
            }
            onPasswordChanged={() =>
              setAdmin((current) => (current ? { ...current, mustChangePassword: false } : current))
            }
          />
        </div>
      </section>
    </AdminShell>
  );
}
