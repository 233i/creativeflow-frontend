"use client";
import { Button } from "@/components/ui/button";
import { adminTabHref } from "@/features/admin/admin-navigation";
import { AdminShell } from "@/features/admin/admin-shell";
import * as adminApi from "@/features/admin/api";
import { WorkflowRunRecords } from "@/features/admin/workflow-center/run-records";
import type { WorkflowDetailController } from "../controllers/use-workflow-detail";
export function DeletedWorkflowDetail({ controller }: { controller: WorkflowDetailController }) {
  const { router, returnHref, identity, setIdentity, item } = controller;
  if (!identity || !item?.deletedAt) return null;
  return (
    <AdminShell
      activeTab="workflows"
      username={identity.username}
      compact
      workspace
      breadcrumb={<span>工作流 / {item.name}</span>}
      onTabChange={(tab) => router.push(adminTabHref(tab))}
      onLogout={() => {
        void adminApi.logout().finally(() => setIdentity(null));
      }}
    >
      <section className="flex h-full min-h-0 flex-col">
        <header className="space-y-2 border-b p-4">
          <Button variant="outline" size="sm" onPress={() => router.push(returnHref)}>
            返回工作流中心
          </Button>
          <h1 className="text-lg font-semibold">{item.name}</h1>
          <p className="text-sm text-muted-foreground">
            已于 {new Date(item.deletedAt).toLocaleString()} 删除 ·
            只读运行历史。生成素材与审计记录保留，不能重新执行、编辑或发布。
          </p>
        </header>
        <div className="min-h-0 flex-1">
          <WorkflowRunRecords item={item!} />
        </div>
      </section>
    </AdminShell>
  );
}
