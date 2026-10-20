import type { WorkflowField } from "./domain/fields";
import type { TransformExpression } from "./domain/nodes";

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export const safeFieldKey = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(value) &&
  !["__proto__", "constructor", "prototype"].includes(value);
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const utf8 = new TextEncoder();

/** 按原始 UTF-8 内容计费预算，不因 JSON 转义把同一段中文重复计算。 */
export function jsonContentBytes(value: unknown): number {
  if (typeof value === "string") return utf8.encode(value).length;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + jsonContentBytes(item), 0);
  if (object(value))
    return Object.entries(value).reduce(
      (sum, [key, item]) => sum + utf8.encode(key).length + jsonContentBytes(item),
      0,
    );
  return utf8.encode(JSON.stringify(value) ?? "null").length;
}

/** 导入与可视化编辑共用有界模式校验，避免未校验的递归结构进入 React 树。 */
export function validFieldSchema(
  value: unknown,
  depth = 0,
  budget = { remaining: 128 },
): value is WorkflowField[] {
  if (
    --budget.remaining < 0 ||
    !Array.isArray(value) ||
    value.length > 16 ||
    depth > 5 ||
    new Set(value.map((field) => (object(field) ? field.key : null))).size !== value.length
  )
    return false;
  if (depth === 0 && new TextEncoder().encode(JSON.stringify(value)).length > 1048576) return false;
  return value.every((field) => {
    if (
      --budget.remaining < 0 ||
      !object(field) ||
      !safeFieldKey(field.key) ||
      ![
        "string",
        "number",
        "boolean",
        "object",
        "array",
        "image",
        ...(depth === 0 ? ["contextChunks", "answer"] : []),
      ].includes(String(field.type)) ||
      typeof field.required !== "boolean"
    )
      return false;
    if (
      Object.keys(field).some(
        (key) =>
          ![
            "key",
            "label",
            "type",
            "required",
            "default",
            "maxLength",
            "minimum",
            "maximum",
            "description",
            "nullable",
            "integer",
            "properties",
            "items",
            "enum",
            "minItems",
            "maxItems",
          ].includes(key),
      )
    )
      return false;
    if (
      field.description !== undefined &&
      (typeof field.description !== "string" || field.description.length > 1000)
    )
      return false;
    if (field.label !== undefined && (typeof field.label !== "string" || field.label.length > 100))
      return false;
    for (const flag of ["integer", "nullable"])
      if (field[flag] !== undefined && typeof field[flag] !== "boolean") return false;
    for (const bound of ["minimum", "maximum", "maxLength", "minItems", "maxItems"])
      if (field[bound] !== undefined && !finite(field[bound])) return false;
    if (field.integer !== undefined && field.type !== "number") return false;
    if (
      field.nullable !== undefined &&
      ["contextChunks", "answer", "image"].includes(String(field.type))
    )
      return false;
    if (
      field.type === "image" &&
      (depth !== 0 ||
        (Object.hasOwn(field, "default") &&
          (!object(field.default) ||
            typeof field.default.assetId !== "string" ||
            !/^[0-9a-f-]{36}$/i.test(field.default.assetId))))
    )
      return false;
    if (
      field.maxLength !== undefined &&
      (!Number.isInteger(field.maxLength) ||
        Number(field.maxLength) < 1 ||
        Number(field.maxLength) > 1048576)
    )
      return false;
    if (finite(field.minimum) && finite(field.maximum) && field.minimum > field.maximum)
      return false;
    for (const bound of ["minItems", "maxItems"])
      if (
        field[bound] !== undefined &&
        (field.type !== "array" ||
          !Number.isInteger(field[bound]) ||
          Number(field[bound]) < 0 ||
          Number(field[bound]) > 100)
      )
        return false;
    if (finite(field.minItems) && finite(field.maxItems) && field.minItems > field.maxItems)
      return false;
    if (
      field.properties !== undefined &&
      (field.type !== "object" || !validFieldSchema(field.properties, depth + 1, budget))
    )
      return false;
    if (
      field.items !== undefined &&
      (field.type !== "array" ||
        !object(field.items) ||
        !validFieldSchema([{ ...field.items, key: "item", required: true }], depth + 1, budget))
    )
      return false;
    if (
      field.enum !== undefined &&
      (!Array.isArray(field.enum) ||
        field.enum.length < 1 ||
        field.enum.length > 32 ||
        field.enum.some((value) =>
          value === null ? field.nullable !== true : typeof value !== field.type,
        ))
    )
      return false;
    if (
      Array.isArray(field.enum) &&
      (new Set(field.enum.map((value) => JSON.stringify(value))).size !== field.enum.length ||
        field.enum.some(
          (value) =>
            !matchesField({ ...field, enum: undefined } as unknown as WorkflowField, value),
        ))
    )
      return false;
    if (
      Object.hasOwn(field, "default") &&
      (!boundedJson(field.default) ||
        !matchesField(field as unknown as WorkflowField, field.default))
    )
      return false;
    return true;
  });
}

/** 类型化输入的实际值校验；不把字符串数字、未知对象键或必填字段缺失隐式纠正。 */
export function matchesField(field: WorkflowField, value: unknown): boolean {
  if (value === null) return field.nullable === true;
  if (field.enum && !field.enum.includes(value as string | number | boolean)) return false;
  switch (field.type) {
    case "string":
      return typeof value === "string" && value.length <= (field.maxLength ?? 1048576);
    case "number":
      return (
        finite(value) &&
        (!field.integer || Number.isInteger(value)) &&
        value >= (field.minimum ?? -Infinity) &&
        value <= (field.maximum ?? Infinity)
      );
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return (
        object(value) &&
        (!field.properties ||
          (Object.keys(value).every((key) =>
            field.properties!.some((field) => field.key === key),
          ) &&
            field.properties.every((child) =>
              Object.hasOwn(value, child.key)
                ? matchesField(child, value[child.key])
                : !child.required,
            )))
      );
    case "array":
      return (
        Array.isArray(value) &&
        value.length >= (field.minItems ?? 0) &&
        value.length <= (field.maxItems ?? 100) &&
        (!field.items || value.every((item) => matchesField(field.items!, item)))
      );
    case "image":
      return (
        object(value) && typeof value.assetId === "string" && /^[0-9a-f-]{36}$/i.test(value.assetId)
      );
    default:
      return false;
  }
}

/** 导入表达式只允许已实现操作和有限深度；属性名禁止原型相关键。 */
export function validExpression(
  value: unknown,
  depth = 0,
  budget = { remaining: 256 },
): value is TransformExpression {
  if (--budget.remaining < 0 || depth > 8 || !object(value)) return false;
  const allowed =
    value.op === "input"
      ? ["op", "input", "path"]
      : value.op === "constant"
        ? ["op", "value"]
        : value.op === "object"
          ? ["op", "properties"]
          : value.op === "get"
            ? ["op", "args", "path"]
            : ["concat", "split", "join"].includes(String(value.op))
              ? ["op", "args", "separator"]
              : ["op", "args"];
  if (Object.keys(value).some((key) => !allowed.includes(key))) return false;
  if (
    value.separator !== undefined &&
    (typeof value.separator !== "string" || value.separator.length > 1000)
  )
    return false;
  if (
    value.path !== undefined &&
    (typeof value.path !== "string" ||
      value.path.length > 512 ||
      (value.path !== "" && !value.path.startsWith("/")) ||
      value.path.split("/").length > 9 ||
      value.path
        .split("/")
        .some(
          (part) =>
            /~(?![01])/.test(part) ||
            ["constructor", "prototype", "__proto__"].includes(
              part.replace(/~1/g, "/").replace(/~0/g, "~"),
            ),
        ))
  )
    return false;
  if (value.op === "constant") return Object.hasOwn(value, "value") && boundedJson(value.value);
  if (value.op === "input") return safeFieldKey(value.input);
  if (value.op === "object")
    return (
      object(value.properties) &&
      Object.keys(value.properties).length <= 16 &&
      Object.entries(value.properties).every(
        ([key, item]) => safeFieldKey(key) && validExpression(item, depth + 1, budget),
      )
    );
  return (
    [
      "get",
      "array",
      "coalesce",
      "concat",
      "parseJson",
      "stringify",
      "toString",
      "toNumber",
      "toBoolean",
      "trim",
      "upper",
      "lower",
      "split",
      "join",
      "length",
      "add",
    ].includes(String(value.op)) &&
    Array.isArray(value.args) &&
    value.args.length <= 32 &&
    (["array", "coalesce", "concat", "add"].includes(String(value.op))
      ? value.op === "array" || value.args.length > 0
      : value.args.length === 1) &&
    value.args.every((item) => validExpression(item, depth + 1, budget))
  );
}

/** 普通数据值的深度和原型键限制与服务端保持一致。 */
export function boundedJson(value: unknown, depth = 0): boolean {
  return boundedShape(value, depth) && jsonContentBytes(value) <= 1048576;
}

/** 先检查深度，再统计内容，避免畸形深层输入在计数阶段耗尽调用栈。 */
function boundedShape(value: unknown, depth: number): boolean {
  if (depth > 8) return false;
  if (value === null || typeof value === "boolean" || finite(value)) return true;
  if (typeof value === "string") return value.length <= 1048576;
  if (Array.isArray(value))
    return value.length <= 100 && value.every((item) => boundedShape(item, depth + 1));
  return (
    object(value) &&
    Object.keys(value).length <= 32 &&
    Object.entries(value).every(
      ([key, item]) =>
        key.length <= 100 &&
        !["constructor", "prototype", "__proto__"].includes(key) &&
        boundedShape(item, depth + 1),
    )
  );
}
