"use client";

import type { WorkflowField } from "./types";
import { ImageValuePicker, parseImageValue } from "./image-value-picker";

type InputElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** 调试和整图输入共用类型控件，显式区分未填写、空字符串与 null。 */
export function FieldInput({
  field,
  draft,
  onChange,
  label,
  className,
  invalid,
  errorId,
  inputRef,
}: {
  field: WorkflowField;
  draft: Record<string, string>;
  onChange: (draft: Record<string, string>) => void;
  label: string;
  className: string;
  invalid?: boolean;
  errorId?: string;
  inputRef?: (element: InputElement | null) => void;
}) {
  const modeKey = `@mode:${field.key}`;
  const mode = draft[modeKey] ?? "value";
  const value = draft[field.key] ?? "";
  const setValue = (next: string) => onChange({ ...draft, [field.key]: next });
  const props = {
    "aria-label": label,
    "aria-invalid": !!invalid,
    "aria-describedby": errorId,
    ref: inputRef,
    className,
    disabled: mode !== "value",
  };
  if (field.type === "image") {
    let selected = null;
    try {
      selected = parseImageValue(value ? JSON.parse(value) : null);
    } catch {
      /* 让外层校验展示具体的 JSON 错误。 */
    }
    return (
      <div className="space-y-1.5">
        <ImageValuePicker
          label={label}
          value={selected}
          onChange={(next) => setValue(next ? JSON.stringify(next) : "")}
          className={mode !== "value" ? "opacity-60" : ""}
        />
        <select
          aria-label={`${label} 值方式`}
          className={className}
          value={mode}
          onChange={(event) => onChange({ ...draft, [modeKey]: event.target.value })}
        >
          <option value="value">使用图片（未选择表示未填写）</option>
          {field.nullable && <option value="null">明确传 null</option>}
        </select>
        {field.description && (
          <p className="text-[11px] leading-5 text-muted-foreground">{field.description}</p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {field.enum ? (
        <select {...props} value={value} onChange={(event) => setValue(event.target.value)}>
          <option value="">未填写</option>
          {field.enum
            .filter((item) => item !== null && item !== "")
            .map((item) => (
              <option key={String(item)} value={String(item)}>
                {String(item)}
              </option>
            ))}
        </select>
      ) : field.type === "boolean" ? (
        <select {...props} value={value} onChange={(event) => setValue(event.target.value)}>
          <option value="">未填写</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : field.type === "number" ? (
        <input
          {...props}
          type="number"
          step={field.integer ? 1 : "any"}
          min={field.minimum}
          max={field.maximum}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      ) : (
        <textarea
          {...props}
          rows={3}
          maxLength={field.type === "string" ? (field.maxLength ?? 1048576) : 1048576}
          value={value}
          placeholder={
            field.type === "object" ? '{"key":"value"}' : field.type === "array" ? '["value"]' : ""
          }
          onChange={(event) => setValue(event.target.value)}
        />
      )}
      {(field.nullable || field.type === "string") && (
        <select
          aria-label={`${label} 值方式`}
          className={`${className} text-muted-foreground`}
          value={mode}
          onChange={(event) => onChange({ ...draft, [modeKey]: event.target.value })}
        >
          <option value="value">使用上方输入（留空表示未填写）</option>
          {field.type === "string" && (!field.enum || field.enum.includes("")) && (
            <option value="empty">明确传空字符串</option>
          )}
          {field.nullable && <option value="null">明确传 null</option>}
        </select>
      )}
      {field.description && (
        <p className="text-[11px] leading-5 text-muted-foreground">{field.description}</p>
      )}
    </div>
  );
}

/** 服务端历史值回填时保留 null 与空字符串，不把它们变成缺省参数。 */
export function inputDraft(
  fields: WorkflowField[],
  inputs: Record<string, unknown>,
): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const field of fields) {
    if (!Object.hasOwn(inputs, field.key)) continue;
    const value = inputs[field.key];
    if (value === null || value === "")
      draft[`@mode:${field.key}`] = value === null ? "null" : "empty";
    else draft[field.key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return draft;
}
