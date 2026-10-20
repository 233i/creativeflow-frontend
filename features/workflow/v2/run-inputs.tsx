"use client";

import { Loader2 } from "lucide-react";
import type { WorkflowV2NodeData } from "./types";
import { actionClass, controlClass } from "./config-styles";
import { parseInputs } from "./types";
import { useRef, useState } from "react";
import { FieldInput } from "./field-input";

/** 仅渲染开始节点的真实字段；object/array 继续使用 JSON，不修改提交协议。 */
export function V2RunInputs({
  fields,
  draft,
  onChange,
  busy,
  error,
  onSubmit,
}: {
  fields: NonNullable<WorkflowV2NodeData["fields"]>;
  draft: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  const [invalid, setInvalid] = useState<Record<string, string>>({});
  const controls = useRef<
    Record<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>
  >({});
  function submit() {
    if (busy) return;
    const issues: Record<string, string> = {};
    for (const field of fields)
      try {
        parseInputs([field], draft);
      } catch (reason) {
        issues[field.key] = reason instanceof Error ? reason.message : "参数无效。";
      }
    setInvalid(issues);
    const first = Object.keys(issues)[0];
    if (first) controls.current[first]?.focus();
    else onSubmit();
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="space-y-4 p-4"
    >
      <p className="text-sm text-muted-foreground">
        每次提交创建新运行，模型与外部操作可能产生费用。关闭面板保留本次输入，不会取消已提交任务。
      </p>
      {Object.keys(invalid).length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {Object.keys(invalid).length} 项参数需要修正。
          {Object.entries(invalid).map(([key, message]) => (
            <button
              key={key}
              type="button"
              className="ml-2 underline"
              onClick={() => controls.current[key]?.focus()}
            >
              {message}
            </button>
          ))}
        </p>
      )}
      <fieldset disabled={busy} className="space-y-4">
        {fields.map((field) => (
          <div key={field.key} className="block space-y-1 text-sm">
            <span>
              {field.label || field.key}
              {field.required && " *"}
            </span>
            <FieldInput
              field={field}
              draft={draft}
              onChange={onChange}
              label={field.label || field.key}
              className={controlClass}
              invalid={!!invalid[field.key]}
              errorId={invalid[field.key] ? `input-error-${field.key}` : undefined}
              inputRef={(element) => {
                controls.current[field.key] = element;
              }}
            />
            <span className="text-xs text-muted-foreground">
              {field.key} · {field.type}
              {field.default !== undefined ? " · 有默认值，留空时由原契约规则处理" : ""}
            </span>
            {invalid[field.key] && (
              <span id={`input-error-${field.key}`} className="block text-destructive">
                {invalid[field.key]}
              </span>
            )}
          </div>
        ))}
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className={`${actionClass} bg-primary text-primary-foreground hover:bg-primary/90`}
      >
        {busy && <Loader2 className="mr-2 inline size-4 animate-spin" />}提交运行
      </button>
    </form>
  );
}
