"use client";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { Bot, Loader2, Trash2, X } from "lucide-react";
import type { AgentPanelController } from "../controllers/use-agent-panel";
import { statusLabel } from "../presentation";
export function AgentHeader({ controller }: { controller: AgentPanelController }) {
  const { t, run, clearConversation, clearing, active, sending, messages, setOpen } = controller;
  return (
    <header className="flex shrink-0 items-center gap-3 border-b px-4 py-4">
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Bot className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold">{t("agent.title")}</h2>
        <p className="truncate text-[0.6875rem] text-muted-foreground">
          {run ? statusLabel(run.status, t) : t("agent.ready")}
        </p>
      </div>
      <TooltipTrigger>
        <Button
          size="icon-sm"
          variant="ghost"
          onPress={clearConversation}
          isDisabled={clearing || active || sending || messages.length === 0}
          aria-label={t("agent.clear")}
        >
          {clearing ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="size-3.5" aria-hidden />
          )}
        </Button>
        <Tooltip>{t("agent.clear")}</Tooltip>
      </TooltipTrigger>
      <TooltipTrigger>
        <Button
          size="icon-sm"
          variant="ghost"
          onPress={() => setOpen(false)}
          aria-label={t("common.close")}
        >
          <X className="size-3.5" aria-hidden />
        </Button>
        <Tooltip>{t("common.close")}</Tooltip>
      </TooltipTrigger>
    </header>
  );
}
