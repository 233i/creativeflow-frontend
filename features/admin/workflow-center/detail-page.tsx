"use client";
import { Button } from "@/components/ui/button";
import { AdminLogin } from "@/features/admin/admin-login";
import { adminTabHref } from "@/features/admin/admin-navigation";
import { AdminShell } from "@/features/admin/admin-shell";
import * as adminApi from "@/features/admin/api";
import { WorkflowDetailContext } from "@/features/admin/workflow-center/detail-context";
import { DeletedWorkflowDetail } from "./components/deleted-workflow-detail";
import { DetailDeleteDialog } from "./components/detail-delete-dialog";
import { DetailHeader } from "./components/detail-header";
import { DetailLeaveDialog } from "./components/detail-leave-dialog";
import { DetailWorkspace } from "./components/detail-workspace";
import { useWorkflowDetail } from "./controllers/use-workflow-detail";
import type { WorkflowDetailProps } from "./detail-types";
export { detailSection } from "./detail-location";
export function WorkflowDetailPage(props: WorkflowDetailProps) {
  const controller = useWorkflowDetail(props);
  const {
    section,
    identity,
    setIdentity,
    checking,
    document,
    setDocument,
    item,
    session,
    setSession,
    error,
    setRetry,
    setPending,
    formDirty,
    formBusy,
    leave,
    context,
  } = controller;
  if (checking)
    return (
      <p role="status" className="p-6 text-sm">
        正在验证管理员身份…
      </p>
    );
  if (!identity) return <AdminLogin onAuthenticated={setIdentity} />;
  if (item?.deletedAt) return <DeletedWorkflowDetail controller={controller} />;
  return (
    <AdminShell
      activeTab="workflows"
      username={identity.username}
      compact
      workspace
      onTabChange={(tab) => leave(adminTabHref(tab))}
      onLogout={() => {
        const logout = () => {
          void adminApi.logout().finally(() => {
            setIdentity(null);
            setSession(null);
            setDocument(null);
          });
        };
        if (session?.dirty || formDirty || formBusy) setPending(() => logout);
        else logout();
      }}
    >
      <WorkflowDetailContext.Provider value={context}>
        <div className="workflow-detail flex h-full min-h-0 flex-col" data-section={section}>
          <DetailHeader controller={controller} />{" "}
          {error && (
            <div role="alert" className="p-4 text-sm text-destructive">
              {error}
              <Button
                variant="outline"
                className="ml-3"
                onPress={() => setRetry((value) => value + 1)}
              >
                重新查询
              </Button>
            </div>
          )}
          {!document && !error && (
            <p role="status" className="p-4 text-sm">
              正在读取工作流…
            </p>
          )}
          <DetailWorkspace controller={controller} />
        </div>
      </WorkflowDetailContext.Provider>
      <DetailDeleteDialog controller={controller} />
      <DetailLeaveDialog controller={controller} />
    </AdminShell>
  );
}
