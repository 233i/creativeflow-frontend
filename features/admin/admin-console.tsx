"use client";

import { AdminLogin } from "@/features/admin/admin-login";
import { adminTabHref, type AdminTab } from "@/features/admin/admin-navigation";
import { AdminShell } from "@/features/admin/admin-shell";
import * as adminApi from "@/features/admin/api";
import { ImageGenerationSettingsPanel } from "@/features/admin/image-generation-settings-panel";
import { PasswordPanel } from "@/features/admin/password-panel";
import { RequestHistoryPanel } from "@/features/admin/request-history/request-history-panel";
import { UserManagementPanel } from "@/features/admin/user-management-panel";
import { WorkflowCenterPanel } from "@/features/admin/workflow-center/panel";
import { WorkflowTemplateManagementPanel } from "@/features/admin/workflow-template-management-panel";
import { useAiStore } from "@/features/ai/store";
import { CredentialPanel } from "@/features/http-requests/credential-panel";
import { KnowledgePanel } from "@/features/knowledge/knowledge-panel";
import { ModelConfigPanel, ModelPanel, ProviderPanel } from "@/features/settings/management-panels";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Button, Loading } from "tdesign-react";
import { AssetCenterPanel } from "./asset-center/panel";

/** 验证管理员身份并协调各管理页面和用户记录跳转。 */
export function AdminConsole({ initialTab = "workflows" }: { initialTab?: AdminTab }) {
  const router = useRouter();
  const [admin, setAdmin] = useState<adminApi.AdminIdentity | null>(null);
  const [checking, setChecking] = useState(true);
  const tab = initialTab;
  function setTab(value: AdminTab) {
    router.push(adminTabHref(value));
  }
  const [shellError, setShellError] = useState<string | null>(null);
  const refreshAdmin = useAiStore((state) => state.refreshAdmin);
  const aiError = useAiStore((state) => state.error);

  useEffect(() => {
    let cancelled = false;
    void adminApi
      .getMe()
      .then(
        (result) => {
          if (!cancelled) setAdmin(result.admin);
        },
        () => {
          if (!cancelled) setAdmin(null);
        },
      )
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!admin) return;
    void refreshAdmin().catch((reason: unknown) => {
      setShellError(reason instanceof Error ? reason.message : "加载全局 AI 配置失败");
    });
  }, [admin, refreshAdmin]);

  if (checking) {
    return (
      <div className="sol-admin-login">
        <Loading size="small" text="正在验证管理员身份…" />
      </div>
    );
  }

  if (!admin) {
    return <AdminLogin onAuthenticated={setAdmin} />;
  }

  /** 结束管理员会话并回到登录页面。 */
  async function logout() {
    try {
      await adminApi.logout();
    } finally {
      setAdmin(null);
    }
  }

  const configurationError = shellError ?? aiError;
  const showConfigurationError =
    tab !== "users" &&
    tab !== "assets" &&
    tab !== "requests" &&
    tab !== "workflowTemplates" &&
    tab !== "workflowApis" &&
    tab !== "workflows" &&
    tab !== "httpCredentials" &&
    tab !== "password"
      ? configurationError
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
        {showConfigurationError && (
          <Alert
            className="sol-admin-error"
            theme="error"
            message={showConfigurationError}
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

        <div key={tab} className="sol-admin-config-panel canvas-fade-in">
          {tab === "users" && (
            <UserManagementPanel
              onViewRequests={(user) => {
                router.push(`/admin/runs?${new URLSearchParams({ accountId: user.id })}`);
              }}
            />
          )}
          {tab === "requests" && <RequestHistoryPanel />}
          {tab === "assets" && <AssetCenterPanel />}
          {tab === "workflowTemplates" && <WorkflowTemplateManagementPanel />}
          {(tab === "workflowApis" || tab === "workflows") && <WorkflowCenterPanel />}
          {tab === "knowledge" && <KnowledgePanel />}
          {tab === "httpCredentials" && <CredentialPanel />}
          {tab === "providers" && <ProviderPanel />}
          {tab === "models" && <ModelPanel />}
          {tab === "modelConfig" && <ModelConfigPanel />}
          {tab === "imageSettings" && <ImageGenerationSettingsPanel />}
          {tab === "password" && (
            <PasswordPanel
              username={admin.username}
              onChanged={() =>
                setAdmin((current) =>
                  current ? { ...current, mustChangePassword: false } : current,
                )
              }
            />
          )}
        </div>
      </section>
    </AdminShell>
  );
}
