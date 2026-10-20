import type { WorkflowNodeRun } from "../types";
import { cn } from "@/lib/utils";
import { NODE_LABELS, usesModel, type WorkflowV2Kind, type NodeConfiguration } from "./types";
import { KnowledgeRetrievalSummary } from "./knowledge-retrieval-summary";

/** 节点状态配色保留原有运行、复用和选中语义，不参与执行调度。 */
export function cardStyle(run: WorkflowNodeRun | undefined, selected: boolean | undefined) {
  const states: Record<string, string> = {
    running: "canvas-node-busy border-primary ring-2 ring-primary/20",
    failed: "border-destructive",
    succeeded: "border-emerald-500/60",
    skipped: "border-dashed bg-muted/40 opacity-65",
  };
  return cn(
    "relative w-72 rounded-xl border bg-card shadow-node transition-shadow",
    selected && "border-primary ring-2 ring-primary/20",
    states[run?.status ?? ""],
    run?.isReused && run.status === "succeeded" && "border-blue-400/60",
  );
}
export function headerStyle(status?: string) {
  const states: Record<string, string> = {
    running: "border-primary/20 bg-primary/5",
    failed: "border-destructive/20 bg-destructive/5",
    succeeded: "bg-emerald-500/5",
  };
  return cn("flex items-center gap-2 rounded-t-[inherit] border-b px-3 py-3", states[status ?? ""]);
}

/** 模型身份和节点配置摘要；检索阶段只根据服务器已上报进度显示。 */
export function NodeCardDescription({
  type,
  data,
  model,
  running,
  progress,
}: {
  type: WorkflowV2Kind;
  data: NodeConfiguration;
  model: { providerName: string; name: string } | undefined;
  running: boolean;
  progress: number | null;
}) {
  const summaries: Partial<Record<WorkflowV2Kind, string>> = {
    transform: `变量处理 · ${data.assignments?.length ?? 0} 个输出 · 不调用模型`,
    intentClassify: "单选意图 · 无匹配走默认分支",
    knowledgeAnswer: "依据片段回答 · 校验引用",
    condition: "首个匹配分支执行 · 其余跳过",
    merge: "每个字段选择唯一活跃来源",
    httpRequest: `${data.http?.method ?? "GET"} · ${data.http?.url || "配置请求地址"}`,
    script: `${data.language === "javascript" ? "JavaScript" : "Python"} · JSON 转换 · 沙箱执行`,
  };
  const modelLabel = modelSummary(model, data.modelId);
  return (
    <>
      {usesModel(type) && (
        <p className="mb-2 px-4 text-muted-foreground">
          {NODE_LABELS[type]} · {modelLabel}
          {type === "llm" && data.outputMode === "json" ? " · JSON" : ""}
        </p>
      )}
      {summaries[type] && (
        <p
          className="mb-2 truncate px-4 text-muted-foreground"
          title={type === "httpRequest" ? data.http?.url : undefined}
        >
          {summaries[type]}
        </p>
      )}
      {type === "knowledgeRetrieve" && (
        <KnowledgeRetrievalSummary data={data} running={running} progress={progress} />
      )}
    </>
  );
}
function modelSummary(model: { providerName: string; name: string } | undefined, id?: string) {
  if (model) return `${model.providerName} / ${model.name}`;
  return id ? "查看模型配置" : "请选择聊天模型";
}
/** 未报告进度时保留不确定状态，不能用客户端计时伪造完成率。 */
export function NodeProgressBar({ progress }: { progress: number | null }) {
  const determinate = progress !== null;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-[inherit] bg-primary/10"
      role={determinate ? "progressbar" : undefined}
      aria-label="节点执行进度"
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={progress ?? undefined}
    >
      <div
        className={cn(
          "h-full bg-primary transition-[width] duration-300 motion-reduce:transition-none",
          !determinate && "w-1/3 animate-pulse motion-reduce:animate-none",
        )}
        style={determinate ? { width: `${progress}%` } : undefined}
      />
    </div>
  );
}
