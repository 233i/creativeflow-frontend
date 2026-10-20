"use client";
import { Input, InputNumber, Textarea } from "tdesign-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { resolveProtocol, type AiModel, type AiProvider } from "@/features/ai/types";
import { useRerankModel } from "../models/use-rerank-model";
import type { RerankSettings } from "@/features/ai/rerank-api";
const numbers: {
  key: keyof Pick<
    RerankSettings,
    | "maxDocuments"
    | "maxDocumentCharacters"
    | "maxQueryCharacters"
    | "timeoutSeconds"
    | "concurrency"
  >;
  label: string;
  min: number;
  max: number;
}[] = [
  { key: "maxDocuments", label: "单次候选上限", min: 1, max: 64 },
  { key: "maxDocumentCharacters", label: "每片段最大字符数", min: 1, max: 16000 },
  { key: "maxQueryCharacters", label: "问题最大字符数", min: 1, max: 4000 },
  { key: "timeoutSeconds", label: "超时（秒）", min: 1, max: 300 },
  { key: "concurrency", label: "渠道并发上限", min: 1, max: 4 },
];
/** Cohere/Jina 兼容模型配置；保存不调用模型，测试明确提示费用。 */
export function RerankModelDialog({
  provider,
  model,
  onClose,
}: {
  provider: AiProvider;
  model: AiModel;
  onClose: () => void;
}) {
  const c = useRerankModel(model.id);
  const protocolReady = resolveProtocol(provider, model) === "rerank";
  const enabled = provider.enabled && model.enabled && protocolReady;
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open && !c.busy) onClose();
      }}
      isDismissable={!c.busy}
      showCloseButton={!c.busy}
      className="!w-[min(720px,calc(100vw-32px))] sm:!max-w-none"
    >
      <div className="max-h-[82vh] space-y-4 overflow-auto p-1">
        <DialogHeader>
          <DialogTitle>重排序配置 · {model.name}</DialogTitle>
          <DialogDescription>
            Cohere / Jina 兼容 rerank 协议，候选编号与原始片段严格对应。
          </DialogDescription>
        </DialogHeader>
        <code className="block break-all rounded bg-muted p-2 text-xs">
          {provider.baseUrl.replace(/\/+$/, "")}/{c.draft?.endpointPath ?? "rerank"}
        </code>
        {!protocolReady && (
          <p role="alert" className="text-amber-700">
            请将协议覆盖设为 rerank。
          </p>
        )}
        {c.error && (
          <p role="alert" className="text-sm text-destructive">
            {c.error}
          </p>
        )}
        <RerankParameters c={c} />
        <RerankTest c={c} enabled={enabled} />
        <Button variant="outline" isDisabled={c.busy} onPress={onClose}>
          关闭
        </Button>
      </div>
    </Dialog>
  );
}
type RerankController = ReturnType<typeof useRerankModel>;
function RerankParameters({ c }: { c: RerankController }) {
  return (
    c.draft && (
      <>
        <label className="block space-y-1 text-xs">
          相对接口路径（Cohere v2 或 Jina v1 的 Base URL 后缀）
          <Input
            value={c.draft.endpointPath}
            disabled={c.busy}
            onChange={(next) => c.change("endpointPath", next)}
          />
        </label>
        <label className="block space-y-1 text-xs">
          模型修订标识
          <Input
            value={c.draft.modelRevision}
            disabled={c.busy}
            onChange={(next) => c.change("modelRevision", next)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          {numbers.map((item) => (
            <label key={item.key} className="space-y-1 text-xs">
              {item.label}
              <InputNumber
                style={{ width: "100%" }}
                theme="normal"
                value={c.draft![item.key]}
                min={item.min}
                max={item.max}
                disabled={c.busy}
                inputProps={{ name: item.key }}
                onChange={(next) => c.change(item.key, next === "" ? 0 : Number(next))}
              />
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          超限不静默截断正文。修改配置会生成新版本，原工作流运行不能冒用新配置继续执行。
        </p>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {c.dirty || !c.saved?.version ? "参数尚未保存，不能测试" : "配置已保存"}
          </p>
          <Button
            isDisabled={c.busy || (!c.dirty && !!c.saved?.version)}
            onPress={() => void c.save()}
          >
            保存重排配置
          </Button>
        </div>
      </>
    )
  );
}
function RerankTest({ c, enabled }: { c: RerankController; enabled: boolean }) {
  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="font-medium">单次重排序测试</h3>
      <p className="text-xs text-amber-700">
        仅发送下方问题和候选，可能产生费用；不会自动重试，不调用回答模型。
      </p>
      <label className="block space-y-1 text-xs">
        测试问题
        <Input value={c.query} disabled={c.busy} maxlength={4000} onChange={c.setQuery} />
      </label>
      <label className="block space-y-1 text-xs">
        候选文档（每行一份）
        <Textarea
          aria-label="重排序测试候选"
          value={c.documentsText}
          disabled={c.busy}
          onChange={c.setDocuments}
        />
      </label>
      <Button
        isDisabled={
          c.busy ||
          !enabled ||
          c.dirty ||
          !c.saved?.version ||
          !c.query.trim() ||
          c.documents.length === 0
        }
        onPress={() => void c.test()}
      >
        {c.busy ? "处理中…" : "发送重排序测试"}
      </Button>
      {c.result && (
        <section aria-label="重排序测试结果" className="rounded border p-3 text-xs">
          <p>
            {c.result.ok ? "测试成功" : c.result.error} · {c.result.elapsedMilliseconds} ms · token{" "}
            {c.result.totalTokens ?? "上游未报告"}
          </p>
          <ol className="mt-2 space-y-2">
            {c.result.results.map((item) => (
              <li key={item.index}>
                <strong>
                  候选 {item.index + 1} · 分数 {item.score.toFixed(4)}
                </strong>
                <p className="break-words">{c.documents[item.index]}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}
