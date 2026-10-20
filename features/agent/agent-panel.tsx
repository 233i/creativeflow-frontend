"use client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AgentComposer } from "./components/agent-composer";
import { AgentConversation } from "./components/agent-conversation";
import { AgentHeader } from "./components/agent-header";
import { useAgentPanel } from "./controllers/use-agent-panel";
export { AssistantCard } from "./conversation-messages";
export function AgentPanel() {
  const controller = useAgentPanel();
  const { t, clearConfirmOpen, setClearConfirmOpen, clearMessages } = controller;
  return (
    <>
      <aside
        aria-label={t("agent.title")}
        className="canvas-panel absolute top-28 right-4 bottom-4 z-20 flex w-[min(25rem,calc(100%-2rem))] flex-col overflow-hidden rounded-xl border shadow-panel sm:top-20"
      >
        <AgentHeader controller={controller} />
        <AgentConversation controller={controller} />
        <AgentComposer controller={controller} />
      </aside>
      <ConfirmDialog
        isOpen={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title={t("agent.clear")}
        description={t("agent.clearConfirm")}
        confirmLabel={t("agent.clear")}
        onConfirm={() => clearMessages()}
      />
    </>
  );
}
