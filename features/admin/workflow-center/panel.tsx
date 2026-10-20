"use client";
import { Button } from "@/components/ui/button";
import { CenterFilters } from "@/features/admin/workflow-center/filters";
import { CenterDialogs } from "./components/center-dialogs";
import { CenterHeader } from "./components/center-header";
import { CenterPagination } from "./components/center-pagination";
import { CenterTable } from "./components/center-table";
import { useWorkflowCenter } from "./controllers/use-workflow-center";
export function WorkflowCenterPanel({ defaultView = "" }: { defaultView?: string }) {
  const controller = useWorkflowCenter(defaultView);
  const {
    params,
    update,
    query,
    error,
    setRefresh,
    capability,
    setSelected,
    actionError,
    setActionError,
    notice,
  } = controller;
  return (
    <section className="sol-admin-panel relative" aria-label="工作流中心">
      <CenterHeader controller={controller} />
      {capability?.create === false && (
        <p className="mb-2 text-xs text-muted-foreground">
          本环境的工作流创建服务未启用或暂不可用，仍可查看有权读取的历史模板。
        </p>
      )}
      <CenterFilters
        query={query}
        params={params}
        onChange={(values) => {
          setSelected(null);
          update(values);
        }}
      />
      {notice && (
        <p role="status" className="mb-2 rounded-lg bg-muted px-3 py-2 text-sm">
          {notice}
        </p>
      )}
      {(error || actionError) && (
        <div
          role="alert"
          className="mb-2 flex shrink-0 items-center justify-between gap-3 rounded-lg bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <span>{actionError ?? error}</span>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              setActionError(null);
              setRefresh((value) => value + 1);
            }}
          >
            重新查询
          </Button>
        </div>
      )}
      <CenterTable controller={controller} />
      <CenterPagination controller={controller} />
      <CenterDialogs controller={controller} />
    </section>
  );
}
