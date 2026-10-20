import { buildWorkflowAgUiResumeCurl } from "../call-example";

/** 与自定义 SSE 分开说明协议身份、续读及最终结果语义。 */
export function PublicationAgUiGuide() {
  return (
    <div className="mt-4 space-y-3 text-xs leading-6 text-muted-foreground">
      <p>
        一次 POST 直接返回标准 AG-UI
        事件流，后台任务独立继续执行。媒体创作与通用编排使用相同发布契约、API Key 和任务队列。
      </p>
      <p>
        <strong>事件：</strong>RUN_STARTED → STATE_SNAPSHOT / STEP_STARTED / STEP_FINISHED →
        TEXT_MESSAGE_START / CONTENT / END → RUN_FINISHED；失败或撤权为
        RUN_ERROR。媒体和完整结构化结果在 RUN_FINISHED.result
        交付，只有公开模型文本及知识答案正文逐步输出。
      </p>
      <p>
        <strong>身份：</strong>threadId 用于外部会话关联，runId 是本次调用的客户端
        ID；它们不会自动启用会话记忆。CUSTOM（workflow.accepted）返回 internalRunId、statusUrl 和
        eventsUrl。新业务使用新 runId；网络重试保持原 runId、threadId 和参数，防止重复付费。
      </p>
      <p>
        <strong>断线续读：</strong>GET eventsUrl 并原样携带最后的 SSE
        id，精确续读步骤、消息和终态。不要把客户端 runId 当作
        internalRunId。仅断开不会取消任务；主动取消使用原状态接口的 DELETE。
      </p>
      <pre className="overflow-x-auto rounded-lg bg-muted/60 p-4 text-foreground">
        <code>{buildWorkflowAgUiResumeCurl()}</code>
      </pre>
      <p>
        流式文本为暂存预览，完成后用 result 替换；失败、取消或撤权时清除预览。浏览器需用 fetch 携带
        Bearer Key，正式集成应由业务后端保护 Key。
        <a className="ml-1 text-primary underline" href="/examples/workflow-agui.mjs" download>
          下载 AG-UI JavaScript 客户端示例
        </a>
        （解析、去重、重连、取消订阅）。
      </p>
    </div>
  );
}
