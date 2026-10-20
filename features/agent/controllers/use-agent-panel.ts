"use client";
import { useT } from "@/components/providers/i18n-provider";
import {
  buildConversationEntries,
  collectToolCalls,
  mergeToolCalls,
} from "@/features/agent/conversation";
import { useAgentStore } from "@/features/agent/store";
import { isAgentRunActive } from "@/features/agent/types";
import { useCanvasStore } from "@/features/canvas/store";
import { useEffect, useMemo, useRef, useState } from "react";

import { summarizeSelectedNode } from "../presentation";
import { useAgentAttachments } from "./use-agent-attachments";
import { useAgentModels } from "./use-agent-models";

export function useAgentPanel() {
  const t = useT();
  const canvasNodes = useCanvasStore((state) => state.nodes);
  const setOpen = useAgentStore((state) => state.setOpen);
  const sendPrompt = useAgentStore((state) => state.sendPrompt);
  const clearMessages = useAgentStore((state) => state.clearMessages);
  const cancel = useAgentStore((state) => state.cancel);
  const messages = useAgentStore((state) => state.messages);
  const run = useAgentStore((state) => state.run);
  const liveBlocks = useAgentStore((state) => state.liveBlocks);
  const liveToolCalls = useAgentStore((state) => state.liveToolCalls);
  const loading = useAgentStore((state) => state.loading);
  const sending = useAgentStore((state) => state.sending);
  const clearing = useAgentStore((state) => state.clearing);
  const error = useAgentStore((state) => state.error);

  const [prompt, setPrompt] = useState("");
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const model = useAgentModels();
  const { selected } = model;
  const active = isAgentRunActive(run);
  const canAttachImages = Boolean(selected?.supportsVision && !active && !sending);
  const images = useAgentAttachments(canAttachImages);
  const { attachments, setAttachments, setAttachmentError, uploading } = images;
  const imagesSupported = !attachments.length || Boolean(selected?.supportsVision);
  const canSend = Boolean(
    prompt.trim() && selected && !active && !sending && !uploading && imagesSupported,
  );
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, liveBlocks, run?.status]);

  const toolCalls = useMemo(
    () => mergeToolCalls(collectToolCalls(messages), liveToolCalls),
    [messages, liveToolCalls],
  );
  const conversation = useMemo(() => buildConversationEntries(messages), [messages]);

  const selectedNodeSummaries = useMemo(
    () => canvasNodes.filter((node) => node.selected).map((node) => summarizeSelectedNode(node, t)),
    [canvasNodes, t],
  );

  function submit() {
    if (!canSend || !selected) return;
    const value = prompt;
    setPrompt("");
    const selectedImages = attachments;
    setAttachments([]);
    setAttachmentError(null);
    void sendPrompt({
      providerId: selected.providerId,
      modelKey: selected.modelKey,
      prompt: value,
      images: selectedImages,
    });
  }

  function clearConversation() {
    if (!messages.length || active || sending || clearing) return;
    setClearConfirmOpen(true);
  }

  return {
    t,
    setOpen,
    clearMessages,
    cancel,
    messages,
    run,
    liveBlocks,
    loading,
    sending,
    clearing,
    error,
    prompt,
    setPrompt,
    clearConfirmOpen,
    setClearConfirmOpen,
    endRef,
    active,
    canAttachImages,
    canSend,
    toolCalls,
    conversation,
    selectedNodeSummaries,
    submit,
    clearConversation,
    ...model,
    ...images,
  };
}
export type AgentPanelController = ReturnType<typeof useAgentPanel>;
