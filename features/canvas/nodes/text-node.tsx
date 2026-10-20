"use client";

import { type NodeProps, NodeResizer, useReactFlow } from "@xyflow/react";
import { Loader2, Minus, Plus, Sparkles, Type, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { resolveSlot, useAiStore } from "@/features/ai/store";
import { NodeActionButton, NodeShell } from "@/features/canvas/nodes/node-shell";
import { useCanvasStore } from "@/features/canvas/store";
import { generateText, spawnTextResult, type TextTask } from "@/features/canvas/text-generation";
import { NODE_MIN_SIZE, type TextNodeData } from "@/features/canvas/types";

const FONT_STEP = 0.15;
const FONT_RANGE = { min: 0.7, max: 2.2 };

export function TextNode({ id, data, selected }: NodeProps) {
  const t = useT();
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const { getNodes, getEdges } = useReactFlow();

  const providers = useAiStore((state) => state.providers);
  const chatSlot = useAiStore((state) => state.slots.chat);

  const [busy, setBusy] = useState<TextTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const nodeData = data as unknown as TextNodeData;
  const fontScale = nodeData.fontScale ?? 1;
  const storedText = nodeData.text ?? "";

  /**
   * 文本框由本地状态驱动，而不是直接绑定状态仓库。
   *
   * 已保存的值经过 zustand 和 React Flow 自身的协调流程后，才会再次以 `data` 下发。
   * 在输入法组字途中重新给文本框设置 `value` 会破坏输入法的组字缓冲区，导致输入拼音时
   * 提交原始拉丁字母，而非正在组合的汉字。使用本地草稿可确保元素只接收它刚刚产生的值。
   */
  const [draft, setDraft] = useState(storedText);
  const composing = useRef(false);

  useEffect(() => {
    // 撤销、AI 改写或提示词库插入都会从外部修改文本。进行中的组字属于用户输入，
    // 因此在提交前应以它为准。
    if (!composing.current) setDraft(storedText);
  }, [storedText]);

  function commit(value: string) {
    setDraft(value);
    // 组字过程中，状态仓库保留最近一次已提交文本；若写入每个中间按键值，
    // 就会把错误值重新反馈给输入框。
    if (!composing.current) updateNodeData(id, { text: value });
  }

  // 两项操作都必须先配置对话模型才能执行。
  const hasChatModel = resolveSlot(providers, chatSlot) !== null;
  const hasText = Boolean(draft.trim());

  function adjustFont(delta: number) {
    const next = Math.min(FONT_RANGE.max, Math.max(FONT_RANGE.min, fontScale + delta));
    updateNodeData(id, { fontScale: Number(next.toFixed(2)) });
  }

  async function run(task: TextTask) {
    if (busy) return;

    setBusy(task);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const result = await generateText(id, task, getNodes(), getEdges(), controller.signal);

    if (result.ok && result.text) {
      // “改写”会替换当前节点文本；“续写”会创建新节点，使原始内容与结果同时保留在画布上。
      if (task === "rewrite") {
        updateNodeData(id, { text: result.text });
      } else {
        spawnTextResult(id, result.text);
      }
    } else if (result.error && result.error !== "aborted") {
      setError(
        result.error === "no-chat-model"
          ? t("node.noChatModel")
          : result.error === "empty"
            ? t("node.textEmpty")
            : result.error,
      );
    }

    setBusy(null);
  }

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_SIZE.width}
        minHeight={NODE_MIN_SIZE.height}
        lineClassName="!border-ring"
        handleClassName="!size-2 !rounded-sm !border-ring !bg-background"
      />

      <NodeShell
        title={t("canvas.nodeText")}
        icon={<Type className="size-3 shrink-0 text-muted-foreground" aria-hidden />}
        selected={selected}
        actions={
          <>
            <NodeActionButton
              size="icon-xs"
              variant="ghost"
              className="size-5"
              onPress={() => adjustFont(-FONT_STEP)}
              label="Decrease font size"
            >
              <Minus className="size-2.5" aria-hidden />
            </NodeActionButton>
            <NodeActionButton
              size="icon-xs"
              variant="ghost"
              className="size-5"
              onPress={() => adjustFont(FONT_STEP)}
              label="Increase font size"
            >
              <Plus className="size-2.5" aria-hidden />
            </NodeActionButton>
          </>
        }
      >
        {/* nodrag 和 nowheel：若不设置，在文本框内拖动会平移画布，滚动会缩放画布，
            导致长文本无法正常使用。 */}
        <textarea
          value={draft}
          onChange={(event) => commit(event.target.value)}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={(event) => {
            // 不同浏览器对 `input` 在 `compositionend` 前还是后触发的行为并不一致，
            // 因此两个事件都提交；后执行的一方只会写入相同的值。
            composing.current = false;
            commit(event.currentTarget.value);
          }}
          placeholder={t("node.textPlaceholder")}
          aria-label={t("canvas.nodeText")}
          className="nodrag nowheel min-h-0 flex-1 resize-none bg-transparent p-2.5 leading-relaxed outline-none placeholder:text-muted-foreground"
          style={{ fontSize: `${fontScale * 0.8125}rem` }}
        />

        {hasChatModel && (
          <div className="nodrag flex shrink-0 items-center gap-1 border-t p-1.5">
            <Button
              size="xs"
              variant="outline"
              className="flex-1 text-[0.625rem]"
              isDisabled={busy !== null}
              onPress={() => void run("write")}
            >
              {busy === "write" ? (
                <Loader2 className="size-2.5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-2.5" aria-hidden />
              )}
              {t("node.writePrompt")}
            </Button>

            <Button
              size="xs"
              variant="outline"
              className="flex-1 text-[0.625rem]"
              isDisabled={busy !== null || !hasText}
              onPress={() => void run("rewrite")}
            >
              {busy === "rewrite" ? (
                <Loader2 className="size-2.5 animate-spin" aria-hidden />
              ) : (
                <Wand2 className="size-2.5" aria-hidden />
              )}
              {t("node.rewrite")}
            </Button>
          </div>
        )}

        {error && (
          <div className="nodrag shrink-0 border-t bg-destructive/5 px-2 py-1.5">
            <p className="text-[0.625rem] leading-tight text-destructive">{error}</p>
          </div>
        )}
      </NodeShell>
    </>
  );
}
