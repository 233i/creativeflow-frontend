"use client";

import { FieldSchemaEditor } from "./schema-editor";
import type { TransformExpression, WorkflowField, WorkflowV2NodeData } from "./types";

const control =
  "w-full min-w-0 rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/25";
const button = "rounded border px-2 py-1 text-xs disabled:opacity-40";

/** 输出约束是显式能力选项；不支持原生模式的渠道不会自动换格式重试。 */
type StructuredKind = "llm" | "parameterExtract" | "intentClassify";
type StructuredConfigProps = {
  [K in StructuredKind]: { kind: K; data: WorkflowV2NodeData<K> };
}[StructuredKind] & {
  onChange: (data: WorkflowV2NodeData) => void;
};
export function StructuredConfig({ kind, data, onChange }: StructuredConfigProps) {
  const structured = kind !== "llm" || data.outputMode === "json";
  return (
    <section className="space-y-3 rounded-xl border bg-muted/20 p-3">
      {kind === "llm" && (
        <label className="block text-xs font-medium">
          输出模式
          <select
            aria-label="输出模式"
            className={control}
            value={data.outputMode ?? "text"}
            onChange={(event) =>
              onChange({
                ...data,
                outputMode: event.target.value as "text" | "json",
                ...(event.target.value === "json" && !data.outputFields?.length
                  ? { outputFields: [{ key: "result", type: "string", required: true }] }
                  : {}),
              })
            }
          >
            <option value="text">文本</option>
            <option value="json">结构化 JSON</option>
          </select>
        </label>
      )}
      {structured && (
        <>
          <label className="block text-xs">
            请求格式
            <select
              aria-label="结构化请求格式"
              className={control}
              value={data.outputTransport ?? "prompt"}
              onChange={(event) =>
                onChange({
                  ...data,
                  outputTransport: event.target.value as "prompt" | "json_schema",
                })
              }
            >
              <option value="prompt">提示词约束 + 严格结果校验</option>
              <option value="json_schema">原生 JSON Schema（渠道须支持）</option>
            </select>
          </label>
          <p className="text-[11px] leading-5 text-muted-foreground">
            只调用一次模型。无效
            JSON、缺少必填字段或类型错误都会明确失败，不自动重试。可选字段缺失不会编造值。
          </p>
          {kind !== "intentClassify" && (
            <FieldSchemaEditor
              fields={data.outputFields ?? []}
              onChange={(outputFields) => onChange({ ...data, outputFields })}
            />
          )}
          {kind === "intentClassify" && (
            <div className="space-y-3">
              <p className="text-xs">
                选择最符合输入的一个意图；都不匹配时走 ELSE。各出口连接下游的执行条件。
              </p>
              {data.intents?.map((intent, index) => (
                <fieldset key={index} className="space-y-2 rounded-lg border bg-background p-2">
                  <legend className="text-xs font-medium">分类 {index + 1}</legend>
                  {(["key", "label", "description"] as const).map((key) => (
                    <label key={key} className="block text-xs">
                      {key === "key" ? "稳定标识" : key === "label" ? "名称" : "分类说明"}
                      {key === "description" ? (
                        <textarea
                          aria-label={`分类 ${index + 1} 说明`}
                          className={control}
                          rows={3}
                          maxLength={1000}
                          value={intent[key]}
                          onChange={(event) =>
                            onChange({
                              ...data,
                              intents: data.intents!.map((item, i) =>
                                i === index ? { ...intent, [key]: event.target.value } : item,
                              ),
                            })
                          }
                        />
                      ) : (
                        <input
                          aria-label={`分类 ${index + 1} ${key === "key" ? "标识" : "名称"}`}
                          className={control}
                          maxLength={key === "key" ? 48 : 100}
                          value={intent[key]}
                          onChange={(event) =>
                            onChange({
                              ...data,
                              intents: data.intents!.map((item, i) =>
                                i === index ? { ...intent, [key]: event.target.value } : item,
                              ),
                            })
                          }
                        />
                      )}
                    </label>
                  ))}
                  <button
                    type="button"
                    className={button}
                    disabled={data.intents!.length <= 1}
                    onClick={() =>
                      onChange({ ...data, intents: data.intents!.filter((_, i) => i !== index) })
                    }
                  >
                    删除分类
                  </button>
                </fieldset>
              ))}
              <button
                type="button"
                className={button}
                disabled={(data.intents?.length ?? 0) >= 8}
                onClick={() => {
                  let index = (data.intents?.length ?? 0) + 1;
                  while (data.intents?.some((item) => item.key === `intent${index}`)) index++;
                  onChange({
                    ...data,
                    intents: [
                      ...(data.intents ?? []),
                      {
                        key: `intent${index}`,
                        label: "新分类",
                        description: "描述什么输入应该进入此分类",
                      },
                    ],
                  });
                }}
              >
                ＋ 添加分类
              </button>
              <div className="rounded-lg border border-dashed p-2 text-xs">
                else · 默认分类（固定，始终保留）
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export const TRANSFORM_OPERATIONS = {
  input: "读取输入 / 嵌套字段",
  constant: "常量",
  get: "读取对象路径",
  object: "组装对象",
  array: "组装数组",
  coalesce: "首个非 null 值",
  concat: "拼接文本",
  parseJson: "解析 JSON",
  stringify: "序列化 JSON",
  toString: "转为字符串",
  toNumber: "转为数字",
  toBoolean: "转为布尔",
  trim: "去除首尾空白",
  upper: "转大写",
  lower: "转小写",
  split: "拆分字符串",
  join: "连接字符串数组",
  length: "长度 / 元素数",
  add: "数值求和",
};
const emptyExpression = (): TransformExpression => ({ op: "constant", value: "" });

/** 可视化表达式树：每层都是受限操作，不提供执行任意代码的入口。 */
export function ExpressionEditor({
  value,
  fields,
  onChange,
  depth = 0,
  label = "表达式",
}: {
  value: TransformExpression;
  fields: WorkflowField[];
  onChange: (value: TransformExpression) => void;
  depth?: number;
  label?: string;
}) {
  const args = value.args ?? [];
  const updateArg = (index: number, next: TransformExpression) =>
    onChange({ ...value, args: args.map((arg, i) => (i === index ? next : arg)) });
  const multiple = ["array", "coalesce", "concat", "add"].includes(value.op);
  return (
    <div className="min-w-0 space-y-2 rounded-lg border bg-background p-2">
      <label className="block text-xs font-medium">
        {label}
        <select
          aria-label={`${label} 操作`}
          className={control}
          value={value.op}
          onChange={(event) => {
            const op = event.target.value;
            onChange(
              op === "input"
                ? { op, input: fields[0]?.key ?? "" }
                : op === "constant"
                  ? emptyExpression()
                  : op === "object"
                    ? { op, properties: { field1: emptyExpression() } }
                    : { op, args: [emptyExpression()] },
            );
          }}
        >
          {Object.entries(TRANSFORM_OPERATIONS).map(([key, title]) => (
            <option
              key={key}
              value={key}
              disabled={depth >= 8 && !["input", "constant"].includes(key)}
            >
              {title}
            </option>
          ))}
        </select>
      </label>
      {value.op === "input" && (
        <select
          aria-label={`${label} 输入`}
          className={control}
          value={value.input ?? ""}
          onChange={(event) => onChange({ ...value, input: event.target.value })}
        >
          <option value="">选择输入字段</option>
          {fields.map((field) => (
            <option key={field.key} value={field.key}>
              {field.label || field.key} · {field.type}
            </option>
          ))}
        </select>
      )}
      {["input", "get"].includes(value.op) && (
        <label className="block text-xs">
          JSON Pointer 路径
          <input
            aria-label={`${label} 路径`}
            className={control}
            placeholder="/customer/name 或 /items/0；留空读取整个值"
            maxLength={512}
            value={value.path ?? ""}
            onChange={(event) => onChange({ ...value, path: event.target.value })}
          />
        </label>
      )}
      {value.op === "constant" && (
        <div className="space-y-2">
          <select
            aria-label={`${label} 常量类型`}
            className={control}
            value={
              value.value === null
                ? "null"
                : Array.isArray(value.value)
                  ? "array"
                  : typeof value.value
            }
            onChange={(event) => {
              const type = event.target.value;
              onChange(
                type === "object"
                  ? { op: "object", properties: {} }
                  : type === "array"
                    ? { op: "array", args: [] }
                    : {
                        op: "constant",
                        value:
                          type === "string"
                            ? ""
                            : type === "number"
                              ? 0
                              : type === "boolean"
                                ? false
                                : null,
                      },
              );
            }}
          >
            <option value="string">字符串</option>
            <option value="number">数字</option>
            <option value="boolean">布尔</option>
            <option value="null">null</option>
            <option value="object">对象（逐字段组装）</option>
            <option value="array">数组（逐元素组装）</option>
          </select>
          {typeof value.value === "string" ? (
            <textarea
              aria-label={`${label} 常量值`}
              className={control}
              rows={2}
              maxLength={16000}
              value={value.value}
              onChange={(event) => onChange({ op: "constant", value: event.target.value })}
            />
          ) : typeof value.value === "number" ? (
            <input
              aria-label={`${label} 常量值`}
              className={control}
              type="number"
              step="any"
              value={value.value}
              onChange={(event) => onChange({ op: "constant", value: Number(event.target.value) })}
            />
          ) : typeof value.value === "boolean" ? (
            <select
              aria-label={`${label} 常量值`}
              className={control}
              value={String(value.value)}
              onChange={(event) =>
                onChange({ op: "constant", value: event.target.value === "true" })
              }
            >
              <option>true</option>
              <option>false</option>
            </select>
          ) : (
            value.value !== null && (
              <pre className="max-h-32 overflow-auto text-xs">
                {JSON.stringify(value.value, null, 2)}
              </pre>
            )
          )}
        </div>
      )}
      {["concat", "split", "join"].includes(value.op) && (
        <label className="block text-xs">
          分隔符
          <input
            aria-label={`${label} 分隔符`}
            className={control}
            maxLength={1000}
            value={value.separator ?? ""}
            onChange={(event) => onChange({ ...value, separator: event.target.value })}
          />
        </label>
      )}
      {value.op === "object" && (
        <div className="space-y-2 border-l-2 border-primary/15 pl-2">
          {Object.entries(value.properties ?? {}).map(([key, expression], index) => (
            <div className="space-y-1" key={index}>
              <div className="flex gap-1">
                <input
                  aria-label={`${label} 对象字段 ${index + 1}`}
                  className={control}
                  value={key}
                  maxLength={48}
                  onChange={(event) => {
                    const entries = Object.entries(value.properties ?? {});
                    if (entries.some(([name], i) => i !== index && name === event.target.value))
                      return;
                    onChange({
                      ...value,
                      properties: Object.fromEntries(
                        entries.map((entry, i) =>
                          i === index ? [event.target.value, entry[1]] : entry,
                        ),
                      ),
                    });
                  }}
                />
                <button
                  type="button"
                  className={button}
                  aria-label={`${label} 删除对象字段 ${index + 1}`}
                  onClick={() =>
                    onChange({
                      ...value,
                      properties: Object.fromEntries(
                        Object.entries(value.properties ?? {}).filter(([name]) => name !== key),
                      ),
                    })
                  }
                >
                  ×
                </button>
              </div>
              <ExpressionEditor
                label={`${label}.${key}`}
                depth={depth + 1}
                fields={fields}
                value={expression}
                onChange={(next) =>
                  onChange({ ...value, properties: { ...value.properties, [key]: next } })
                }
              />
            </div>
          ))}
          <button
            type="button"
            className={button}
            disabled={Object.keys(value.properties ?? {}).length >= 16 || depth >= 8}
            onClick={() => {
              let index = Object.keys(value.properties ?? {}).length + 1;
              while (`field${index}` in (value.properties ?? {})) index++;
              onChange({
                ...value,
                properties: { ...value.properties, [`field${index}`]: emptyExpression() },
              });
            }}
          >
            ＋ 对象字段
          </button>
        </div>
      )}
      {args.map((arg, index) => (
        <div key={index} className="space-y-1 border-l-2 border-primary/15 pl-2">
          <ExpressionEditor
            label={`${label} 参数 ${index + 1}`}
            value={arg}
            fields={fields}
            depth={depth + 1}
            onChange={(next) => updateArg(index, next)}
          />
          {multiple && (
            <button
              type="button"
              className={button}
              disabled={args.length <= (value.op === "array" ? 0 : 1)}
              onClick={() => onChange({ ...value, args: args.filter((_, i) => i !== index) })}
            >
              删除参数 {index + 1}
            </button>
          )}
        </div>
      ))}
      {multiple && (
        <button
          type="button"
          className={button}
          disabled={args.length >= 32 || depth >= 8}
          onClick={() => onChange({ ...value, args: [...args, emptyExpression()] })}
        >
          ＋ 参数
        </button>
      )}
    </div>
  );
}

export function TransformConfig({
  data,
  onChange,
}: {
  data: WorkflowV2NodeData<"transform">;
  onChange: (data: WorkflowV2NodeData<"transform">) => void;
}) {
  return (
    <section className="space-y-3">
      <p className="rounded-lg bg-primary/5 p-3 text-xs leading-5">
        在当前节点内转换输入并生成命名输出，不调用模型。路径缺失返回 null，可用“首个非 null
        值”显式提供默认值；类型转换不会自动发生。
      </p>
      <FieldSchemaEditor
        fields={data.outputFields ?? []}
        onChange={(outputFields) =>
          onChange({
            ...data,
            outputFields,
            assignments: outputFields.map((field, index) => ({
              key: field.key,
              expression:
                data.assignments?.find((row) => row.key === field.key)?.expression ??
                data.assignments?.[index]?.expression ??
                emptyExpression(),
            })),
          })
        }
      />
      {(data.outputFields ?? []).map((field, index) => (
        <ExpressionEditor
          key={field.key}
          label={`输出 ${field.key}`}
          fields={data.fields}
          value={
            data.assignments?.find((row) => row.key === field.key)?.expression ?? emptyExpression()
          }
          onChange={(expression) =>
            onChange({
              ...data,
              assignments: (data.outputFields ?? []).map((output, i) => ({
                key: output.key,
                expression:
                  i === index
                    ? expression
                    : (data.assignments?.find((row) => row.key === output.key)?.expression ??
                      emptyExpression()),
              })),
            })
          }
        />
      ))}
    </section>
  );
}
