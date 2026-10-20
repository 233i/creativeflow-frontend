"use client";

import { BookOpen } from "lucide-react";
import { useState } from "react";
import { useI18n, useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  appendPrompt,
  PROMPT_CATEGORY_LABELS,
  promptsByCategory,
} from "@/features/canvas/prompt-library";
import { useCanvasStore } from "@/features/canvas/store";
import { cn } from "@/lib/utils";

/**
 * 将精选提示词片段插入文本节点。
 *
 * 支持多选和追加：条目是修饰语，用户可选择多个并保留自己的主体。
 * 选择只在确认时应用，而不是点击时立即应用，因此可浏览对话框而不提交。
 */
export function PromptLibraryDialog({
  isOpen,
  onOpenChange,
  targetNodeId,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** 要插入的节点。为空时创建新文本节点。 */
  targetNodeId: string | null;
}) {
  const t = useT();
  const { locale } = useI18n();

  const nodes = useCanvasStore((state) => state.nodes);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const addNode = useCanvasStore((state) => state.addNode);

  const [selected, setSelected] = useState<string[]>([]);

  function changeOpen(open: boolean) {
    if (!open) setSelected([]);
    onOpenChange(open);
  }

  function toggle(text: string) {
    setSelected((current) =>
      current.includes(text) ? current.filter((value) => value !== text) : [...current, text],
    );
  }

  function apply() {
    if (selected.length === 0) {
      onOpenChange(false);
      return;
    }

    if (targetNodeId) {
      const node = nodes.find((candidate) => candidate.id === targetNodeId);
      const current = ((node?.data as { text?: string } | undefined)?.text ?? "").trim();

      updateNodeData(targetNodeId, {
        text: selected.reduce((text, addition) => appendPrompt(text, addition), current),
      });
    } else {
      // 放在原点附近；用户接下来通常会自行拖动。
      addNode("text", { x: 0, y: 0 }, { text: selected.join(", ") });
    }

    setSelected([]);
    onOpenChange(false);
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={changeOpen}
      className="w-[min(52rem,calc(100vw-2rem))] max-w-none sm:max-w-none"
    >
      <DialogHeader>
        <DialogTitle>{t("canvas.promptLibrary")}</DialogTitle>
        <DialogDescription>{t("canvas.promptLibraryHint")}</DialogDescription>
      </DialogHeader>

      <div className="flex max-h-[48vh] flex-col gap-6 overflow-y-auto">
        {promptsByCategory().map(([category, entries]) => (
          <section key={category} className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">
              {PROMPT_CATEGORY_LABELS[category][locale === "zh" ? "zh" : "en"]}
            </h3>

            <div className="flex flex-wrap gap-1.5">
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={selected.includes(entry.text)}
                  onClick={() => toggle(entry.text)}
                  // 实际插入的是英文文本，因此悬停时值得显示。
                  title={entry.text}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                    selected.includes(entry.text)
                      ? "border-primary/40 bg-accent font-medium text-primary"
                      : "border-border hover:bg-accent",
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {selected.length > 0 && (
        <section
          className="rounded-xl border bg-muted/30 p-4"
          aria-label={t("canvas.promptPreview")}
        >
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {t("canvas.promptPreview")}
          </p>
          <p className="max-h-20 overflow-y-auto text-sm leading-relaxed" aria-live="polite">
            {selected.join(", ")}
          </p>
        </section>
      )}

      <DialogFooter>
        <span className="mr-auto text-xs text-muted-foreground">
          {selected.length > 0 ? t("canvas.promptSelected", { count: selected.length }) : ""}
        </span>
        <Button variant="outline" size="sm" onPress={() => changeOpen(false)}>
          {t("common.cancel")}
        </Button>
        <Button size="sm" isDisabled={selected.length === 0} onPress={apply}>
          <BookOpen className="size-3.5" aria-hidden />
          {t("common.add")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
