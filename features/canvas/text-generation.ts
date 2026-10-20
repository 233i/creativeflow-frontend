"use client";

import { resolveSlot, useAiStore } from "@/features/ai/store";
import { useCanvasStore } from "@/features/canvas/store";
import { collectUpstream } from "@/features/canvas/upstream";
import type { CanvasEdge, CanvasNode } from "@/features/canvas/store";

/**
 * 画布文本生成。
 *
 * 两种操作都会写入文本节点：
 *  - **编写**：将上游上下文转换为新的图片提示词；
 *  - **改写**：原地改进节点自身文本。
 *
 * 两者都使用已配置的聊天模型角色，因此用户只需在设置中选择一次模型，
 * 而不用在每个节点选择。存在参考图时会向上传递，从而可根据图片编写提示词。
 */

const WRITE_SYSTEM_PROMPT = [
  "You write prompts for image generation models.",
  "Turn the user's material into one vivid, concrete prompt.",
  "Describe subject, composition, lighting and style. Prefer concrete nouns over adjectives.",
  "Reply with the prompt only — no preamble, no quotes, no explanation.",
].join(" ");

const REWRITE_SYSTEM_PROMPT = [
  "You improve prompts for image generation models.",
  "Keep the author's intent and subject; add concrete visual detail where it is vague.",
  "Match the language of the input.",
  "Reply with the improved prompt only — no preamble, no quotes, no explanation.",
].join(" ");

export type TextTask = "write" | "rewrite";

export interface TextGenerationOutcome {
  ok: boolean;
  text?: string;
  error?: string;
}

/**
 * 使用已配置聊天模型运行文本任务。
 *
 * 返回结果而不修改图：文本节点拥有自己的忙碌状态，并决定如何处理结果，
 * 使该函数未来仍可用于预览。
 */
export async function generateText(
  nodeId: string,
  task: TextTask,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  signal?: AbortSignal,
): Promise<TextGenerationOutcome> {
  const { providers, slots } = useAiStore.getState();

  // 快速模型更适合改写；不可用时回退到主聊天角色。
  const slot = task === "rewrite" ? (slots.fast ?? slots.chat) : slots.chat;
  const resolved = resolveSlot(providers, slot) ?? resolveSlot(providers, slots.chat);

  if (!resolved) {
    return { ok: false, error: "no-chat-model" };
  }

  const node = nodes.find((candidate) => candidate.id === nodeId);
  const ownText = ((node?.data as { text?: string } | undefined)?.text ?? "").trim();
  const upstream = collectUpstream(nodeId, nodes, edges);

  const prompt =
    task === "rewrite" ? ownText : [upstream.prompt, ownText].filter(Boolean).join("\n\n");

  if (!prompt && upstream.images.length === 0) {
    return { ok: false, error: "empty" };
  }

  try {
    const response = await fetch("/api/v1/ai/text", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        canvasId: useCanvasStore.getState().canvasId,
        nodeId,
        providerId: resolved.provider.id,
        modelKey: resolved.model.modelKey,
        prompt: prompt || "Write an image prompt describing the attached image.",
        systemPrompt: task === "rewrite" ? REWRITE_SYSTEM_PROMPT : WRITE_SYSTEM_PROMPT,
        images: upstream.images.map((image) => image.url),
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      let detail = `Request failed (${response.status})`;
      try {
        const body = (await response.json()) as { error?: string; details?: string[] };
        detail = body.details?.[0] ?? body.error ?? detail;
      } catch {
        // 保留根据状态码生成的消息。
      }
      return { ok: false, error: detail };
    }

    const { text } = (await response.json()) as { text: string };
    return { ok: true, text: text.trim() };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, error: "aborted" };
    }
    return { ok: false, error: error instanceof Error ? error.message : "failed" };
  }
}

/** 将生成的提示词写入源节点右侧的新文本节点。 */
export function spawnTextResult(sourceId: string, text: string): string | null {
  return useCanvasStore.getState().spawnOutput(sourceId, "text", { text });
}
