"use client";

import { Brain, Check, ChevronDown, CircleAlert, Loader2, Wrench } from "lucide-react";
import type { Translate } from "@/components/providers/i18n-provider";
import { mergeDisplayBlocks, type ToolCallView } from "@/features/agent/conversation";
import {
  parseAgentContent,
  type AgentContentBlock,
  type AgentMessage,
} from "@/features/agent/types";

const TOOL_LABELS = {
  read_canvas: "agent.toolNames.readCanvas",
  get_node_status: "agent.toolNames.getNodeStatus",
  subscribe_node: "agent.toolNames.subscribeNode",
  wait_for_node_event: "agent.toolNames.waitForNodeEvent",
  create_node: "agent.toolNames.createNode",
  update_node: "agent.toolNames.updateNode",
  connect_nodes: "agent.toolNames.connectNodes",
  select_nodes: "agent.toolNames.selectNodes",
  duplicate_nodes: "agent.toolNames.duplicateNodes",
  delete_nodes: "agent.toolNames.deleteNodes",
  disconnect_nodes: "agent.toolNames.disconnectNodes",
  move_nodes: "agent.toolNames.moveNodes",
  resize_node: "agent.toolNames.resizeNode",
  run_node: "agent.toolNames.runNode",
  retry_node: "agent.toolNames.retryNode",
  cancel_node: "agent.toolNames.cancelNode",
  manage_canvas: "agent.toolNames.manageCanvas",
  load_skill: "agent.toolNames.loadSkill",
  run_skill_script: "agent.toolNames.runSkillScript",
  edit_image: "agent.toolNames.editImage",
} as const;

const SERVER_TOOLS = new Set(["load_skill", "run_skill_script"]);

function isServerTool(name: string): boolean {
  return SERVER_TOOLS.has(name) || !TOOL_LABELS[name as keyof typeof TOOL_LABELS];
}

export function MessageBubble({ index, message }: { index: number; message: AgentMessage }) {
  const blocks = parseAgentContent(message.contentJson);
  const text = blocks
    .filter((block) => block.kind === "text" && block.text)
    .map((block) => block.text)
    .join("\n");
  const images = blocks.filter((block) => block.kind === "image" && block.imageUrl);
  if (!text && images.length === 0) return null;

  return (
    <div
      style={{ animationDelay: Math.min(index * 35, 280) + "ms" }}
      className="agent-message-enter ml-auto max-w-[88%] rounded-xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
    >
      {images.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {images.map((image) => (
            <div key={image.imageUrl} className="overflow-hidden rounded-md border border-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.imageUrl!} alt="" className="max-h-32 max-w-32 object-cover" />
            </div>
          ))}
        </div>
      )}
      {text && <p className="whitespace-pre-wrap break-words leading-6">{text}</p>}
    </div>
  );
}

export function AssistantCard({
  index,
  blocks,
  liveBlocks = [],
  liveText = "",
  liveThinking = "",
  live,
  toolCalls,
  t,
}: {
  index: number;
  blocks: AgentContentBlock[];
  liveBlocks?: AgentContentBlock[];
  /** 为 liveBlocks 引入前的调用方保留。 */
  liveText?: string;
  liveThinking?: string;
  live: boolean;
  toolCalls: Map<string, ToolCallView>;
  t: Translate;
}) {
  const compatibilityBlocks: AgentContentBlock[] = [
    ...(liveThinking ? [{ kind: "thinking" as const, text: liveThinking }] : []),
    ...(liveText ? [{ kind: "text" as const, text: liveText }] : []),
  ];
  const runtimeBlocks = liveBlocks.length > 0 ? liveBlocks : compatibilityBlocks;
  const displayBlocks = mergeDisplayBlocks(blocks, runtimeBlocks).filter(
    (block) =>
      (block.kind === "text" && Boolean(block.text)) ||
      (block.kind === "thinking" && Boolean(block.text)) ||
      (block.kind === "tool_use" && Boolean(block.toolUseId)),
  );
  if (displayBlocks.length === 0 && !live) {
    return null;
  }

  return (
    <article
      style={{ animationDelay: Math.min(index * 35, 280) + "ms" }}
      className="agent-message-enter max-w-[92%] rounded-xl rounded-bl-sm border bg-card px-3 py-2 text-sm shadow-sm"
    >
      <div className="space-y-2">
        {displayBlocks.map((block, blockIndex) => {
          if (block.kind === "text") {
            return (
              <p
                key={`${block.kind}-${blockIndex}`}
                data-agent-block="text"
                className="whitespace-pre-wrap break-words leading-6"
              >
                {block.text}
              </p>
            );
          }

          if (block.kind === "thinking") {
            return (
              <div key={`${block.kind}-${blockIndex}`} data-agent-block="thinking">
                <ThinkingBlock text={block.text} live={live} t={t} />
              </div>
            );
          }

          const tool = toolCalls.get(block.toolUseId!);
          if (!tool) return null;
          return (
            <div key={tool.id} data-agent-block="tool">
              <ToolCallCard call={tool} index={blockIndex} t={t} />
            </div>
          );
        })}

        {displayBlocks.length === 0 && live && (
          <span
            data-agent-block="working"
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {t("agent.working")}
          </span>
        )}
      </div>
    </article>
  );
}

function ThinkingBlock({
  text,
  live = false,
  t,
}: {
  text?: string | null;
  live?: boolean;
  t: Translate;
}) {
  const hasText = Boolean(text);
  return (
    <details
      className={
        live
          ? "agent-thinking-live group rounded-lg border px-2.5 py-2 text-xs"
          : "group rounded-lg border border-border/70 bg-muted/25 px-2.5 py-2 text-xs"
      }
      open={live || undefined}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 select-none">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Brain className="size-3.5" aria-hidden />
        </span>
        <span className="font-medium">{live ? t("agent.thinkingLive") : t("agent.thinking")}</span>
        {live && (
          <span className="ml-auto flex items-center gap-1 text-[0.625rem] text-muted-foreground">
            <span className="agent-thinking-dot size-1.5 rounded-full bg-primary" aria-hidden />
            <span>{t("agent.working")}</span>
          </span>
        )}
        {hasText && (
          <ChevronDown
            className="ml-auto size-3.5 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          />
        )}
      </summary>
      {hasText && (
        <p className="mt-2 border-l-2 border-primary/20 pl-2 whitespace-pre-wrap leading-5 text-muted-foreground">
          {text}
        </p>
      )}
    </details>
  );
}

function ToolCallCard({ call, index, t }: { call: ToolCallView; index: number; t: Translate }) {
  const running = call.result === null;
  const label = toolLabel(call.name, t);
  const status = running ? "running" : call.isError ? "failed" : "succeeded";
  const statusLabel = running
    ? t("agent.toolRunning")
    : call.isError
      ? t("agent.toolFailed")
      : t("agent.toolSucceeded");

  return (
    <details
      className="agent-tool-enter group rounded-lg border border-border/70 bg-background/55 text-xs"
      style={{ animationDelay: Math.min(index * 45, 180) + "ms" }}
      open={running}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 select-none">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Wrench className="size-3.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-medium">{label}</span>
            <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[0.5625rem] text-muted-foreground">
              {isServerTool(call.name) ? t("agent.toolServer") : t("agent.toolCanvas")}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[0.625rem] text-muted-foreground">
            <ToolStatusIcon status={status} />
            {statusLabel}
          </span>
        </span>
        <ChevronDown
          className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="space-y-2 border-t px-2.5 py-2">
        <PayloadPreview label={t("agent.toolInput")} value={call.input} />
        {call.result !== null && (
          <PayloadPreview label={t("agent.toolOutput")} value={call.result} error={call.isError} />
        )}
      </div>
    </details>
  );
}

function ToolStatusIcon({ status }: { status: "running" | "succeeded" | "failed" }) {
  if (status === "running") return <Loader2 className="size-3 animate-spin" aria-hidden />;
  if (status === "failed") return <CircleAlert className="size-3 text-destructive" aria-hidden />;
  return <Check className="size-3 text-emerald-600" aria-hidden />;
}

function PayloadPreview({
  label,
  value,
  error = false,
}: {
  label: string;
  value: string;
  error?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <pre
        className={
          error
            ? "max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-md bg-destructive/10 px-2 py-1.5 font-mono text-[0.625rem] leading-4 text-destructive"
            : "max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/60 px-2 py-1.5 font-mono text-[0.625rem] leading-4 text-muted-foreground"
        }
      >
        {formatPayload(value)}
      </pre>
    </div>
  );
}

function toolLabel(name: string, t: Translate): string {
  const translationKey = TOOL_LABELS[name as keyof typeof TOOL_LABELS];
  return translationKey
    ? t(translationKey)
    : name.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatPayload(value: string): string {
  try {
    const formatted = JSON.stringify(JSON.parse(value), null, 2);
    return formatted.length > 2_000 ? formatted.slice(0, 2_000) + "…" : formatted;
  } catch {
    return value.length > 2_000 ? value.slice(0, 2_000) + "…" : value;
  }
}
