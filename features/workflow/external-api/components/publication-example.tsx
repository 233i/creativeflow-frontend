"use client";
import { Button } from "@/components/ui/button";
import {
  buildWorkflowPollCurl,
  buildWorkflowStreamCurl,
} from "@/features/workflow/external-api/call-example";
import { Check, Clipboard } from "lucide-react";
import type { PublicationController } from "../controllers/use-publication-controller";
import { PublicationAgUiGuide } from "./publication-agui-guide";

export function PublicationExample({ controller }: { controller: PublicationController }) {
  const { copied, exampleMode, setExampleMode, copy, sample } = controller;
  const streamExample = exampleMode === "stream";

  return (
    <section className="rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">调用示例</h3>
        <Button size="sm" variant="outline" onPress={() => void copy(sample)}>
          {copied ? <Check className="size-3.5" /> : <Clipboard className="size-3.5" />}
          复制
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="返回方式">
        <Button
          size="sm"
          variant={exampleMode === "agui" ? "default" : "outline"}
          aria-pressed={exampleMode === "agui"}
          onPress={() => setExampleMode("agui")}
        >
          AG-UI 标准协议
        </Button>
        <Button
          size="sm"
          variant={streamExample ? "default" : "outline"}
          aria-pressed={streamExample}
          onPress={() => setExampleMode("stream")}
        >
          SSE 流式返回
        </Button>
        <Button
          size="sm"
          variant={exampleMode === "poll" ? "default" : "outline"}
          aria-pressed={exampleMode === "poll"}
          onPress={() => setExampleMode("poll")}
        >
          查询最终结果
        </Button>
      </div>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-muted/60 p-4 text-xs leading-6 text-foreground">
        <code>{sample}</code>
      </pre>
      {exampleMode === "agui" ? (
        <PublicationAgUiGuide />
      ) : (
        <>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            1. 提交返回 202、runId、statusUrl 和 eventsUrl，生成在后台继续。
            <br />
            2.{" "}
            {streamExample
              ? "使用同一个 Key GET eventsUrl，持续接收执行进度、公开文本片段和最终结果。"
              : "每隔 2–5 秒 GET statusUrl，直到 succeeded / failed / cancelled。"}
            <br />
            3. 网络重试使用原幂等键、原输入和原 stream 设置；业务新任务使用新的幂等键。
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-muted/60 p-4 text-xs">
            <code>{streamExample ? buildWorkflowStreamCurl() : buildWorkflowPollCurl()}</code>
          </pre>
          {streamExample && (
            <div className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
              <p>
                <strong>事件：</strong>
                run.progress（进度）、output.delta（追加文本）、run.completed / run.failed /
                run.cancelled（终态）。断线只需用 Last-Event-ID
                续读，不会重复执行。收到终态后停止重连。
              </p>
              <p>
                文本片段是暂存预览，以 run.completed.outputs
                替换为最终结果；失败、取消或撤权时清除预览。只有直接或经汇合连接到结束字段的模型文本与知识答案正文会逐步输出；结构化数据、引用和媒体在完成后交付。
              </p>
              <p>
                浏览器携带 Bearer Key 时使用 fetch 读取响应流。
                <a className="text-primary underline" href="/examples/workflow-stream.mjs" download>
                  下载 JavaScript 订阅示例
                </a>
                （包含事件解析与断线重连）。
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
