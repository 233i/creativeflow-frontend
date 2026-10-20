"use client";
import {
  FastForward,
  FileImage,
  Film,
  ImageIcon,
  Save,
  ScanLine,
  Sparkles,
  Type,
} from "lucide-react";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MediaNodeLibrary } from "../media-node-library";
import type { MediaEditorModel } from "../controllers/use-media-editor";
export function MediaPalette({ editor, managed }: { editor: MediaEditorModel; managed: boolean }) {
  const t = useT();
  const detail = managed;
  const { nodes, addAt } = editor.canvas;
  const partialRerunSelecting = !!editor.partial.selection;
  const saveNow = editor.draft.save;
  return detail ? (
    <MediaNodeLibrary disabled={partialRerunSelecting} count={nodes.length} onAdd={addAt} />
  ) : (
    <aside
      className={cn(
        "canvas-panel absolute inset-x-3 top-28 z-20 flex items-center gap-1 overflow-x-auto rounded-xl border p-1.5 shadow-node sm:top-20 md:inset-x-auto md:left-4 md:w-44 md:flex-col md:items-stretch md:overflow-visible md:p-2",
        partialRerunSelecting && "pointer-events-none opacity-50",
        detail && "!top-3 md:!left-3",
      )}
    >
      <p className="hidden px-2 py-2 text-xs font-medium text-muted-foreground md:block">
        {t("workflow.nodeLibrary")}
      </p>
      <PaletteButton icon={Type} label={t("workflow.nodeText")} onClick={() => addAt("text")} />
      <PaletteButton
        icon={FileImage}
        label={t("workflow.nodeImage")}
        onClick={() => addAt("image")}
      />
      <PaletteButton
        icon={Sparkles}
        label={t("workflow.nodeImageGenerate")}
        onClick={() => addAt("imageGenerate")}
      />
      <PaletteButton
        icon={Film}
        label={t("workflow.nodeVideoGenerate")}
        onClick={() => addAt("videoGenerate")}
      />
      <PaletteButton
        icon={FastForward}
        label={t("workflow.nodeVideoExtend")}
        onClick={() => addAt("videoExtend")}
      />
      <PaletteButton
        icon={ScanLine}
        label={t("workflow.nodeVideoFrame")}
        onClick={() => addAt("videoFrame")}
      />
      <PaletteButton
        icon={ImageIcon}
        label={t("workflow.nodeImageOutput")}
        onClick={() => addAt("imageOutput")}
      />
      <PaletteButton
        icon={Film}
        label={t("workflow.nodeVideoOutput")}
        onClick={() => addAt("videoOutput")}
      />
      <div className="mx-1 h-6 w-px shrink-0 bg-border md:mx-0 md:my-1 md:h-px md:w-auto" />
      <Button
        size="xs"
        variant="ghost"
        className="shrink-0 justify-start"
        onPress={() => void saveNow()}
      >
        <Save className="size-3" />
        {t("common.save")}
      </Button>
    </aside>
  );
}
function PaletteButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Type;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring md:w-full"
    >
      <Icon className="size-4 text-muted-foreground" aria-hidden />
      {label}
    </button>
  );
}
