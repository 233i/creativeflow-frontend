"use client";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { type SaveState } from "@/features/canvas/sync";
import { cn } from "@/lib/utils";
import { Check, CloudAlert, Loader2, Type } from "lucide-react";

export function ToolButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: typeof Type;
  label: string;
  onPress: () => void;
}) {
  return (
    <TooltipTrigger>
      <Button
        size="icon-sm"
        variant="ghost"
        onPress={onPress}
        aria-label={label}
        className="size-8 shrink-0"
      >
        <Icon className="size-4" aria-hidden />
      </Button>
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}

export function MenuItem({
  icon: Icon,
  label,
  onSelect,
  destructive,
}: {
  icon: typeof Type;
  label: string;
  onSelect: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group/item flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent",
        destructive && "text-destructive hover:bg-destructive/10",
      )}
    >
      <Icon
        className={cn(
          "size-3.5 transition-transform duration-150 group-hover/item:scale-110",
          destructive ? "text-destructive" : "text-muted-foreground",
        )}
        aria-hidden
      />
      {label}
    </button>
  );
}

/**
 * 显示编辑内容是否已保存到服务端。
 *
 * `idle` 状态不渲染内容，常驻指示器只会造成干扰。失败状态会一直显示，
 * 因为静默保存失败会让用户在不知情的情况下丢失工作。
 */
export function SaveIndicator({ state }: { state: SaveState }) {
  const t = useT();

  if (state === "idle") return null;

  if (state === "error") {
    return (
      <span className="canvas-fade-in flex items-center gap-1 px-1.5 text-[0.6875rem] text-destructive">
        <CloudAlert className="size-3.5" aria-hidden />
        {t("canvas.saveFailed")}
      </span>
    );
  }

  return (
    <span className="canvas-fade-in flex items-center gap-1 px-1.5 text-[0.6875rem] text-muted-foreground">
      {state === "saving" ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : (
        <Check className="size-3" aria-hidden />
      )}
      {state === "saving" ? t("canvas.saving") : t("canvas.saved")}
    </span>
  );
}
