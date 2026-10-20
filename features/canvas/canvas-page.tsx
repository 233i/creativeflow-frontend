"use client";
import { Button } from "@/components/ui/button";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Loader2 } from "lucide-react";
import { CanvasEditor } from "./components/canvas-editor";
import { useCanvasProjects } from "./controllers/use-canvas-projects";
export function CanvasPage() {
  const { canvasId, setCanvasId, projects, setProjects, resolveError, t } = useCanvasProjects();
  if (resolveError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-destructive">{resolveError}</p>
        <Button size="sm" variant="outline" onPress={() => window.location.reload()}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  if (!canvasId) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      {/* 使用 key，使切换文档时重新挂载编辑器并获得干净的历史记录。 */}
      <CanvasEditor
        key={canvasId}
        canvasId={canvasId}
        projects={projects}
        onProjectsChange={setProjects}
        onSwitch={setCanvasId}
      />
    </ReactFlowProvider>
  );
}
