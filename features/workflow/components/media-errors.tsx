"use client";
import { useT } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";
import { validationMessage } from "../presentation/media-labels";
import type { MediaEditorModel } from "../controllers/use-media-editor";
export function MediaErrors({
  editor,
  onLocate,
}: {
  editor: MediaEditorModel;
  onLocate: (id: string) => void;
}) {
  const t = useT();
  const issues = editor.actions.issues;
  const error = editor.session.error;
  const connectionError = editor.connectionError;
  const partialRerunSelecting = !!editor.partial.selection;
  const issueText = [...new Set(issues.map((issue) => issue.code))]
    .map((code) => validationMessage(t, code))
    .join(" · ");
  if (!issueText && !error && !connectionError) return null;
  return (
    <div
      role="alert"
      className={cn(
        "absolute top-44 left-1/2 z-20 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-destructive/30 bg-background px-3 py-2 text-xs text-destructive shadow-node sm:top-36 md:max-w-xl",
        partialRerunSelecting ? "md:top-32" : "md:top-20",
      )}
    >
      {error ?? connectionError ?? issues.length + " 项校验错误：" + issueText}
      {issues.some((issue) => issue.nodeId) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {issues
            .filter((issue) => issue.nodeId)
            .map((issue, index) => (
              <button
                key={index}
                className="rounded border px-2 py-1 text-sm underline"
                onClick={() => {
                  if (issue.nodeId) onLocate(issue.nodeId);
                }}
              >
                {validationMessage(t, issue.code)} · {issue.nodeId}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
