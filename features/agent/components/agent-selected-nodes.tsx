"use client";
import type { AgentPanelController } from "../controllers/use-agent-panel";
export function AgentSelectedNodes({ controller }: { controller: AgentPanelController }) {
  const { t, selectedNodeSummaries } = controller;
  return (
    <>
      {" "}
      {selectedNodeSummaries.length > 1 && (
        <div
          data-testid="agent-selected-nodes"
          className="mb-2 border-b border-border/70 pb-2"
          aria-label={t("agent.selectedNodes", { count: selectedNodeSummaries.length })}
        >
          <p className="text-[0.625rem] font-medium text-muted-foreground">
            {t("agent.selectedNodes", { count: selectedNodeSummaries.length })}
          </p>
          <div className="mt-1.5 flex max-h-16 flex-wrap gap-1 overflow-y-auto">
            {selectedNodeSummaries.map((node) => (
              <span
                key={node.id}
                title={node.detail ? `${node.typeLabel}: ${node.detail}` : node.typeLabel}
                className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted/70 px-1.5 py-1 text-[0.625rem]"
              >
                <span className="shrink-0 font-medium text-foreground">{node.typeLabel}</span>
                {node.detail && (
                  <span className="min-w-0 truncate text-muted-foreground">{node.detail}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
