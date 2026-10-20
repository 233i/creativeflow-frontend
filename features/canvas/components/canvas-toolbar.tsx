"use client";
import { Brand } from "@/components/layout/brand";
import { StudioHeader } from "@/components/layout/studio-header";
import { AuthMenu } from "@/features/auth/auth-menu";
import { exportCanvas, importCanvas } from "@/features/canvas/persistence";
import { ProjectMenu } from "@/features/canvas/project-menu";
import { downloadJson } from "@/lib/download";
import { cn } from "@/lib/utils";
import { BackgroundVariant } from "@xyflow/react";
import {
  Bot,
  Download,
  Grid3x3,
  LayoutGrid,
  Redo2,
  Settings,
  Undo2,
  Upload as UploadIcon,
} from "lucide-react";
import type { CanvasController } from "../controllers/use-canvas-editor";
import { SaveIndicator, ToolButton } from "./canvas-controls";
export function CanvasToolbar({ controller }: { controller: CanvasController }) {
  const {
    t,
    canvasId,
    projects,
    onProjectsChange,
    onSwitch,
    saveState,
    undo,
    redo,
    runAutoLayout,
    setBackground,
    getNodes,
    getEdges,
    importRef,
    setAgentOpen,
    agentOpen,
    setSettingsOpen,
    load,
    fitView,
  } = controller;
  return (
    <>
      {" "}
      <StudioHeader>
        <Brand className="shrink-0 max-lg:[&>span]:hidden" />
        <div className="h-5 w-px bg-border" />
        <div className="relative min-w-0 flex-1 sm:w-48 sm:flex-none">
          <ProjectMenu
            currentId={canvasId}
            projects={projects}
            onProjectsChange={onProjectsChange}
            onSwitch={onSwitch}
          />
        </div>
        <span className="hidden rounded-md bg-accent px-2 py-1 text-xs text-primary xl:block">
          {t("projects.canvasTitle")}
        </span>
        <div className="hidden flex-1 sm:block" />
        <div className={cn(saveState !== "error" && "hidden lg:block")}>
          <SaveIndicator state={saveState} />
        </div>
        <div className="flex items-center gap-1 max-sm:w-full max-sm:justify-between">
          <ToolButton icon={Undo2} label={t("canvas.undo")} onPress={undo} />
          <ToolButton icon={Redo2} label={t("canvas.redo")} onPress={redo} />
          <ToolButton icon={LayoutGrid} label={t("canvas.autoArrange")} onPress={runAutoLayout} />
          <ToolButton
            icon={Grid3x3}
            label={t("canvas.background")}
            onPress={() =>
              setBackground((current) =>
                current === BackgroundVariant.Dots
                  ? BackgroundVariant.Lines
                  : current === BackgroundVariant.Lines
                    ? "none"
                    : BackgroundVariant.Dots,
              )
            }
          />
          <div className="mx-0.5 h-5 w-px bg-border" />
          <ToolButton
            icon={Download}
            label={t("canvas.exportCanvas")}
            onPress={() =>
              downloadJson(
                `creativeflow-canvas-${canvasId.slice(0, 8)}.json`,
                exportCanvas(getNodes(), getEdges()),
              )
            }
          />
          <ToolButton
            icon={UploadIcon}
            label={t("canvas.importCanvas")}
            onPress={() => importRef.current?.click()}
          />
          <div className="mx-0.5 h-5 w-px bg-border" />
          <ToolButton icon={Bot} label={t("agent.open")} onPress={() => setAgentOpen(!agentOpen)} />
          <ToolButton
            icon={Settings}
            label={t("canvas.settings")}
            onPress={() => setSettingsOpen(true)}
          />
          <div className="mx-1 h-5 w-px bg-border" />
          <AuthMenu compact />
        </div>
      </StudioHeader>
      {/* 工具栏导入按钮对应的文件输入框。 */}
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          // 先重置，使再次导入同一文件时仍会触发 change 事件。
          event.target.value = "";
          if (!file) return;

          const result = importCanvas(await file.text());
          if (!result.ok) {
            window.alert(`${t("canvas.importCanvas")}: ${result.detail}`);
            return;
          }

          load({ nodes: result.snapshot.nodes, edges: result.snapshot.edges });
          void fitView({ duration: 200, maxZoom: 1 });
        }}
      />
    </>
  );
}
