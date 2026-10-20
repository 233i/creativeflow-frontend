import type { WorkflowField } from "./fields";
import { boundedJson, jsonContentBytes, matchesField } from "../data-validation";

const OMIT_INPUT = Symbol("omit input");

function validateInputField(field: WorkflowField) {
  if (field.type === "contextChunks" || field.type === "answer")
    throw new Error("知识证据不能通过外部输入伪造");
  if (
    !/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(field.key) ||
    ["__proto__", "constructor", "prototype"].includes(field.key)
  )
    throw new Error("参数标识无效");
}

function parseEnteredValue(field: WorkflowField, raw: string): unknown {
  let value: unknown = raw;
  if (field.type !== "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error(`${field.label || field.key} 不是有效的 ${field.type}`);
    }
  }
  if (!boundedJson(value) || !matchesField(field, value))
    throw new Error(`${field.label || field.key} 不符合字段模式、枚举或范围限制`);
  return value;
}

function parseInputField(field: WorkflowField, draft: Record<string, string>): unknown {
  validateInputField(field);
  const mode = draft[`@mode:${field.key}`] ?? "value";
  if (mode !== "value") {
    const value = mode === "null" ? null : mode === "empty" ? "" : undefined;
    if (!matchesField(field, value)) throw new Error(`${field.label || field.key} 不允许此空值`);
    return value;
  }
  const raw = draft[field.key] ?? "";
  if (raw === "" && "default" in field) return OMIT_INPUT;
  if (raw === "") {
    if (field.required) throw new Error(`请填写 ${field.label || field.key}`);
    return OMIT_INPUT;
  }
  return parseEnteredValue(field, raw);
}

/** 表单空可选值省略，不隐式转换错误类型；默认值由服务器应用。 */
export function parseInputs(
  fields: WorkflowField[],
  draft: Record<string, string>,
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  for (const field of fields) {
    const value = parseInputField(field, draft);
    if (value !== OMIT_INPUT) inputs[field.key] = value;
  }
  if (jsonContentBytes(inputs) > 2 * 1048576 + 8192) throw new Error("输入超过节点数据预算");
  return inputs;
}
