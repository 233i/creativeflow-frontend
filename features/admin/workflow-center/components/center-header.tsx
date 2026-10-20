"use client";
import { Button } from "@/components/ui/button";
import { Columns3, Plus, RefreshCw, Upload } from "lucide-react";
import type { WorkflowCenterController } from "../controllers/use-workflow-center";
export function CenterHeader({ controller }: { controller: WorkflowCenterController }) {
  const {
    loading,
    setRefresh,
    capability,
    page,
    density,
    setDensity,
    setColumnDialog,
    setCreating,
    setInitial,
    fileInput,
  } = controller;
  return (
    <header className="sol-admin-panel-header">
      <div className="flex items-center gap-2">
        <h2>工作流</h2>
        <span
          className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          aria-label="工作流总数"
        >
          {page?.total ?? "—"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="表格密度"
          className="sol-admin-control"
          value={density === "compact" ? "compact" : "default"}
          onChange={(event) => setDensity(event.target.value)}
        >
          <option value="default">默认密度</option>
          <option value="compact">紧凑密度</option>
        </select>
        <Button
          size="sm"
          variant="outline"
          aria-label="设置显示列"
          onPress={() => setColumnDialog(true)}
        >
          <Columns3 size={15} />显示列
        </Button>
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="刷新工作流"
          isDisabled={loading}
          onPress={() => setRefresh((value) => value + 1)}
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <Button
          variant="outline"
          size="sm"
          isDisabled={!capability?.create}
          onPress={() => fileInput.current?.click()}
        >
          <Upload className="size-4" />
          导入
        </Button>
        <Button
          size="sm"
          isDisabled={!capability?.create}
          onPress={() => {
            setInitial(undefined);
            setCreating(true);
          }}
        >
          <Plus className="size-4" />
          新建工作流
        </Button>
      </div>
    </header>
  );
}
