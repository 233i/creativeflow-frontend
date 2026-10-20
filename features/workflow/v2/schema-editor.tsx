"use client";

import { FIELD_TYPES, type FieldType, type WorkflowField } from "./types";

const control =
  "w-full min-w-0 rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/25";
const button = "rounded border px-2 py-1 text-xs disabled:opacity-40";
const newField = (key: string): WorkflowField => ({ key, type: "string", required: true });

/** 对象、数组和字段约束共用可视化编辑器，不要求用户手写 JSON Schema。 */
export function FieldSchemaEditor({
  fields,
  onChange,
  label = "输出字段",
  depth = 0,
}: {
  fields: WorkflowField[];
  onChange: (fields: WorkflowField[]) => void;
  label?: string;
  depth?: number;
}) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="mb-2 text-xs font-semibold">{label}</legend>
      {fields.map((field, index) => (
        <details key={index} className="rounded-lg border bg-background" open={fields.length < 3}>
          <summary className="cursor-pointer truncate px-2 py-2 text-xs">
            <span className="font-mono">{field.key || "未命名"}</span>{" "}
            <span className="text-muted-foreground">
              {field.type}
              {field.required ? " · 必填" : " · 可选"}
            </span>
          </summary>
          <div className="space-y-2 border-t p-2">
            <div className="flex gap-2">
              <label className="min-w-0 flex-1 text-xs">
                字段标识
                <input
                  aria-label={`${label} ${index + 1} 标识`}
                  className={control}
                  value={field.key}
                  maxLength={48}
                  onChange={(event) =>
                    onChange(
                      fields.map((item, i) =>
                        i === index ? { ...field, key: event.target.value } : item,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                aria-label={`${label} ${index + 1} 上移`}
                className={button}
                disabled={index === 0}
                onClick={() => {
                  const next = [...fields];
                  [next[index - 1], next[index]] = [next[index], next[index - 1]];
                  onChange(next);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`${label} ${index + 1} 删除`}
                className={button}
                disabled={depth === 0 && fields.length <= 1}
                onClick={() => onChange(fields.filter((_, i) => i !== index))}
              >
                删除
              </button>
            </div>
            <SchemaValueEditor
              field={field}
              depth={depth}
              onChange={(next) => onChange(fields.map((item, i) => (i === index ? next : item)))}
            />
          </div>
        </details>
      ))}
      <button
        type="button"
        className={button}
        disabled={fields.length >= 16 || depth > 5}
        onClick={() => {
          let index = fields.length + 1;
          while (fields.some((field) => field.key === `field${index}`)) index++;
          onChange([...fields, newField(`field${index}`)]);
        }}
      >
        ＋ 添加{depth ? "子字段" : "输出字段"}
      </button>
    </fieldset>
  );
}

/** 单个值的类型与约束；嵌套模式也可复用于开始/结束及普通节点输入。 */
export function SchemaValueEditor({
  field,
  onChange,
  depth = 0,
  hideType = false,
  allowImage = true,
}: {
  field: WorkflowField;
  onChange: (field: WorkflowField) => void;
  depth?: number;
  hideType?: boolean;
  allowImage?: boolean;
}) {
  const primitive = ["string", "number", "boolean"].includes(field.type);
  const constraint = (
    key: "maxLength" | "minimum" | "maximum" | "minItems" | "maxItems",
    label: string,
    min?: number,
    max?: number,
  ) => (
    <label className="min-w-0 text-xs" key={key}>
      {label}
      <input
        aria-label={`${field.key} ${label}`}
        className={control}
        type="number"
        min={min}
        max={max}
        step={key === "minimum" || key === "maximum" ? "any" : 1}
        value={field[key] ?? ""}
        onChange={(event) => {
          const next = { ...field };
          if (event.target.value === "") delete next[key];
          else next[key] = Number(event.target.value);
          onChange(next);
        }}
      />
    </label>
  );
  return (
    <div className="space-y-2">
      {!hideType && (
        <>
          <label className="block text-xs">
            显示名称
            <input
              className={control}
              value={field.label ?? ""}
              maxLength={100}
              onChange={(event) => onChange({ ...field, label: event.target.value })}
            />
          </label>
          <div className="flex items-center gap-2">
            <select
              aria-label={`${field.key} 类型`}
              className={control}
              value={field.type}
              onChange={(event) => {
                const type = event.target.value as FieldType;
                onChange({
                  key: field.key,
                  label: field.label,
                  description: field.description,
                  type,
                  required: field.required,
                  ...(type === "object"
                    ? { properties: [newField("field1")] }
                    : type === "array"
                      ? { items: newField("item") }
                      : {}),
                });
              }}
            >
              {FIELD_TYPES.filter((type) => (depth === 0 && allowImage) || type !== "image").map(
                (type) => (
                  <option
                    key={type}
                    disabled={depth >= 5 && (type === "object" || type === "array")}
                  >
                    {type}
                  </option>
                ),
              )}
            </select>
            <label className="flex shrink-0 items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(event) => onChange({ ...field, required: event.target.checked })}
              />
              必填
            </label>
          </div>
        </>
      )}
      <label className="block text-xs">
        字段说明
        <textarea
          aria-label={`${field.key} 字段说明`}
          rows={2}
          maxLength={1000}
          className={control}
          value={field.description ?? ""}
          onChange={(event) => onChange({ ...field, description: event.target.value })}
        />
      </label>
      {field.type !== "image" && (
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={field.nullable ?? false}
            onChange={(event) => onChange({ ...field, nullable: event.target.checked })}
          />
          允许明确的 null 值
        </label>
      )}
      {field.type === "string" && constraint("maxLength", "最大字符数", 1, 1048576)}
      {field.type === "number" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {constraint("minimum", "最小值")}
            {constraint("maximum", "最大值")}
          </div>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={field.integer ?? false}
              onChange={(event) => onChange({ ...field, integer: event.target.checked })}
            />
            仅整数
          </label>
        </>
      )}
      {primitive && (
        <fieldset className="space-y-1">
          <legend className="text-xs">枚举（不设置则不限制）</legend>
          {field.enum?.map((value, index) => (
            <div key={index} className="flex gap-1">
              {field.type === "boolean" ? (
                <select
                  aria-label={`${field.key} 枚举 ${index + 1}`}
                  className={control}
                  value={String(value)}
                  onChange={(event) =>
                    onChange({
                      ...field,
                      enum: field.enum!.map((item, i) =>
                        i === index ? event.target.value === "true" : item,
                      ),
                    })
                  }
                >
                  <option>true</option>
                  <option>false</option>
                </select>
              ) : (
                <input
                  aria-label={`${field.key} 枚举 ${index + 1}`}
                  className={control}
                  type={field.type === "number" ? "number" : "text"}
                  value={String(value ?? "")}
                  maxLength={1048576}
                  onChange={(event) =>
                    onChange({
                      ...field,
                      enum: field.enum!.map((item, i) =>
                        i === index
                          ? field.type === "number"
                            ? Number(event.target.value)
                            : event.target.value
                          : item,
                      ),
                    })
                  }
                />
              )}
              <button
                type="button"
                className={button}
                aria-label={`${field.key} 删除枚举 ${index + 1}`}
                onClick={() => {
                  const next: WorkflowField = {
                    ...field,
                    enum: field.enum!.filter((_, i) => i !== index),
                  };
                  if (!next.enum?.length) delete next.enum;
                  onChange(next);
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className={button}
            disabled={(field.enum?.length ?? 0) >= 32}
            onClick={() =>
              onChange({
                ...field,
                enum: [
                  ...(field.enum ?? []),
                  field.type === "number" ? 0 : field.type === "boolean" ? true : "",
                ],
              })
            }
          >
            ＋ 枚举值
          </button>
        </fieldset>
      )}
      {field.type === "object" && (
        <div className="space-y-2 border-l-2 border-primary/15 pl-2">
          {!field.properties ? (
            <button
              type="button"
              className={button}
              disabled={depth >= 5}
              onClick={() => onChange({ ...field, properties: [newField("field1")] })}
            >
              定义对象子字段
            </button>
          ) : (
            <FieldSchemaEditor
              label={`${field.key} 子字段`}
              depth={depth + 1}
              fields={field.properties}
              onChange={(properties) => onChange({ ...field, properties })}
            />
          )}
        </div>
      )}
      {field.type === "array" && (
        <div className="space-y-2 border-l-2 border-primary/15 pl-2">
          <div className="grid grid-cols-2 gap-2">
            {constraint("minItems", "最少元素", 0, 100)}
            {constraint("maxItems", "最多元素", 0, 100)}
          </div>
          <span className="text-xs font-medium">数组元素</span>
          {!field.items ? (
            <button
              type="button"
              className={button}
              disabled={depth >= 5}
              onClick={() => onChange({ ...field, items: newField("item") })}
            >
              定义元素类型
            </button>
          ) : (
            <SchemaValueEditor
              depth={depth + 1}
              field={{ ...field.items, key: "item", required: true }}
              onChange={(items) => onChange({ ...field, items })}
            />
          )}
        </div>
      )}
      {depth >= 5 && (
        <p className="text-[11px] text-muted-foreground">
          最多五层嵌套；总模式与实际值仍受服务端预算校验。
        </p>
      )}
    </div>
  );
}
