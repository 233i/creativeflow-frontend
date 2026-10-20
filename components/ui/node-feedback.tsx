import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

/** 节点反馈参与布局，长错误独立滚动，不能遮住表单或截断服务商诊断。 */
export function NodeFeedback({ message, actions }: { message: string; actions?: ReactNode }) {
  return (
    <div
      role="alert"
      className="nodrag nowheel flex max-h-32 shrink-0 items-start gap-2 overflow-y-auto rounded-b-[inherit] border-t border-destructive/15 bg-destructive/5 px-3 py-2.5 text-xs text-destructive"
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words leading-relaxed [overflow-wrap:anywhere]">
        {message}
      </p>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
