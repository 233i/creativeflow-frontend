"use client";
import { BookOpen, Film, ImageIcon, Images, Type, Wand2, Workflow } from "lucide-react";
import type { CanvasController } from "../controllers/use-canvas-editor";
import { ToolButton } from "./canvas-controls";
export function CanvasPalette({ controller }: { controller: CanvasController }) {
  const { t, addAt, setTemplatesOpen, setPromptsOpen, setAssetsOpen } = controller;
  return (
    <aside aria-label={t("workflow.nodeLibrary")} className="absolute top-28 left-4 z-20 sm:top-20">
      <div className="canvas-panel flex flex-col gap-1 rounded-xl border p-1.5 shadow-node">
        <ToolButton icon={Type} label={t("canvas.nodeText")} onPress={() => addAt("text")} />
        <ToolButton icon={ImageIcon} label={t("canvas.nodeImage")} onPress={() => addAt("image")} />
        <div className="my-0.5 h-px bg-border" />
        <ToolButton
          icon={Wand2}
          label={t("canvas.nodeImageGen")}
          onPress={() => addAt("imageGen")}
        />
        <ToolButton
          icon={Film}
          label={t("canvas.nodeVideoGen")}
          onPress={() => addAt("videoGen")}
        />
        <div className="my-0.5 h-px bg-border" />
        <ToolButton
          icon={Workflow}
          label={t("canvas.workflowTemplates")}
          onPress={() => setTemplatesOpen(true)}
        />
        <ToolButton
          icon={BookOpen}
          label={t("canvas.promptLibrary")}
          onPress={() => setPromptsOpen(true)}
        />
        <ToolButton
          icon={Images}
          label={t("canvas.assetLibrary")}
          onPress={() => setAssetsOpen(true)}
        />
      </div>
    </aside>
  );
}
