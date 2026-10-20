"use client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUp, CircleStop, Loader2 } from "lucide-react";
import { IMAGE_ACCEPT } from "../controllers/use-agent-attachments";
import type { AgentPanelController } from "../controllers/use-agent-panel";
import { AgentAttachments } from "./agent-attachments";
import { AgentModelSelect } from "./agent-model-select";
import { AgentSelectedNodes } from "./agent-selected-nodes";
export function AgentComposer({ controller }: { controller: AgentPanelController }) {
  const {
    t,
    error,
    imageInputRef,
    acceptImages,
    prompt,
    setPrompt,
    submit,
    active,
    sending,
    models,
    cancel,
    canSend,
  } = controller;
  return (
    <footer className="shrink-0 border-t bg-background/95 p-3">
      {error && (
        <p className="mb-2 rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => void acceptImages(event.target.files)}
      />

      <div className="rounded-xl border bg-background p-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
        <AgentSelectedNodes controller={controller} />
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          disabled={active || sending || models.length === 0}
          placeholder={t("agent.placeholder")}
          rows={3}
          aria-label={t("agent.placeholder")}
          className="block max-h-40 min-h-16 resize-none border-0 bg-transparent px-1 py-0 text-sm outline-none focus-visible:ring-0 disabled:opacity-50"
        />
        <AgentAttachments controller={controller} />
        <div className="mt-1 flex items-center gap-1.5">
          <AgentModelSelect controller={controller} />
          {active ? (
            <Button size="sm" variant="destructive" onPress={() => void cancel()}>
              <CircleStop className="size-3.5" aria-hidden />
              {t("agent.stop")}
            </Button>
          ) : (
            <TooltipTrigger>
              <Button
                size="icon-sm"
                className="rounded-full"
                onPress={submit}
                isDisabled={!canSend}
                aria-label={t("agent.send")}
              >
                {sending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <ArrowUp className="size-3.5" aria-hidden />
                )}
              </Button>
              <Tooltip>{t("agent.send")}</Tooltip>
            </TooltipTrigger>
          )}
        </div>
      </div>
    </footer>
  );
}
