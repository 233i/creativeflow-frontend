"use client";
import { AssistantCard, MessageBubble } from "@/features/agent/conversation-messages";
import { Bot, Loader2 } from "lucide-react";
import type { AgentPanelController } from "../controllers/use-agent-panel";
export function AgentConversation({ controller }: { controller: AgentPanelController }) {
  const { t, loading, messages, liveBlocks, active, conversation, run, toolCalls, endRef } =
    controller;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-muted/15 px-4 py-5" aria-live="polite">
      {loading ? (
        <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("common.loading")}
        </div>
      ) : messages.length === 0 && liveBlocks.length === 0 && !active ? (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <Bot className="mb-3 size-8 text-muted-foreground/60" aria-hidden />
          <p className="text-sm font-medium">{t("agent.empty")}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("agent.emptyHint")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {conversation.map((entry, index) => {
            if (entry.kind === "user") {
              return <MessageBubble key={entry.id} index={index} message={entry.message} />;
            }

            const currentRun = run?.id === entry.runId;
            return (
              <AssistantCard
                key={entry.id}
                index={index}
                blocks={entry.blocks}
                liveBlocks={currentRun ? liveBlocks : []}
                live={currentRun && active}
                toolCalls={toolCalls}
                t={t}
              />
            );
          })}

          {run &&
            !conversation.some((entry) => entry.kind === "assistant" && entry.runId === run.id) &&
            (active || liveBlocks.length > 0) && (
              <AssistantCard
                key={`assistant-${run.id}`}
                index={conversation.length}
                blocks={[]}
                liveBlocks={liveBlocks}
                live={active}
                toolCalls={toolCalls}
                t={t}
              />
            )}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
