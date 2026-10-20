"use client";

import {
  branchPorts,
  canConnect,
  CONTROL_PORT,
  NODE_LABELS,
  type BranchRule,
  type FieldType,
  type WorkflowV2Graph,
  type WorkflowV2Node,
  type WorkflowV2NodeData,
} from "./types";

const control =
  "w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:border-primary";
const action = "rounded-lg border px-2 py-1 text-xs disabled:opacity-40";
const labels: Record<string, string> = {
  eq: "等于",
  ne: "不等于",
  gt: "大于",
  gte: "大于等于",
  lt: "小于",
  lte: "小于等于",
  contains: "包含",
  startsWith: "开头是",
  endsWith: "结尾是",
  isTrue: "为真",
  isFalse: "为假",
  isPresent: "已提供",
  isMissing: "未提供",
  isEmpty: "为空",
  notEmpty: "非空",
  hasHits: "有检索命中",
  noHits: "没有检索命中",
  isGrounded: "回答有依据",
  notGrounded: "回答依据不足",
};

export function operators(type: FieldType): string[] {
  const typed =
    type === "contextChunks"
      ? ["hasHits", "noHits"]
      : type === "answer"
        ? ["isGrounded", "notGrounded"]
        : type === "boolean"
          ? ["isTrue", "isFalse", "eq", "ne"]
          : type === "number"
            ? ["eq", "ne", "gt", "gte", "lt", "lte"]
            : type === "string"
              ? ["eq", "ne", "contains", "startsWith", "endsWith", "isEmpty", "notEmpty"]
              : ["isEmpty", "notEmpty"];
  return [...typed, "isPresent", "isMissing"];
}
function binary(op: string) {
  return ["eq", "ne", "gt", "gte", "lt", "lte", "contains", "startsWith", "endsWith"].includes(op);
}
function rule(input: string, type: FieldType, op = operators(type)[0]): BranchRule {
  return binary(op)
    ? { input, operator: op, value: type === "number" ? 0 : type === "boolean" ? true : "" }
    : { input, operator: op };
}

/** 条件以有类型的行配置，不接受表达式脚本；案例顺序即 IF / ELSE IF 优先级。 */
export function V2BranchConfig({
  data,
  onChange,
}: {
  data: WorkflowV2NodeData<"condition">;
  onChange: (data: WorkflowV2NodeData<"condition">) => void;
}) {
  const cases = data.cases ?? [];
  function replace(index: number, next: (typeof cases)[number]) {
    onChange({ ...data, cases: cases.map((item, i) => (i === index ? next : item)) });
  }
  return (
    <section aria-label="分支规则" className="space-y-3">
      <p className="rounded-lg bg-amber-500/10 p-3 text-xs leading-5">
        按顺序选择首个满足条件的分支，其余分支跳过。所有分支（含
        ELSE）都需要连接执行条件端口，再通过结果汇合节点输出。
      </p>
      {cases.map((branch, index) => (
        <div key={branch.key} className="space-y-3 rounded-xl border p-3">
          <div className="flex items-center justify-between">
            <strong className="text-xs">
              {index === 0 ? "IF" : "ELSE IF"} · {branch.key}
            </strong>
            <button
              className={action}
              disabled={cases.length <= 1}
              onClick={() => onChange({ ...data, cases: cases.filter((_, i) => i !== index) })}
            >
              删除分支
            </button>
          </div>
          <input
            aria-label={`分支 ${index + 1} 名称`}
            className={control}
            value={branch.label ?? ""}
            maxLength={100}
            onChange={(event) => replace(index, { ...branch, label: event.target.value })}
          />
          <select
            aria-label={`分支 ${index + 1} 组合方式`}
            className={control}
            value={branch.match}
            onChange={(event) =>
              replace(index, { ...branch, match: event.target.value as "all" | "any" })
            }
          >
            <option value="all">满足全部条件（AND）</option>
            <option value="any">满足任一条件（OR）</option>
          </select>
          {branch.conditions.map((condition, i) => {
            const field = data.fields.find((item) => item.key === condition.input);
            function change(next: BranchRule) {
              replace(index, {
                ...branch,
                conditions: branch.conditions.map((item, j) => (j === i ? next : item)),
              });
            }
            return (
              <div key={i} className="space-y-2 rounded-lg bg-muted/40 p-2">
                <select
                  aria-label={`分支 ${index + 1} 条件 ${i + 1} 变量`}
                  className={control}
                  value={condition.input}
                  onChange={(event) => {
                    const next = data.fields.find((item) => item.key === event.target.value);
                    if (next) change(rule(next.key, next.type));
                  }}
                >
                  {!field && <option value={condition.input}>原字段失效，请重新选择</option>}
                  {data.fields.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label || item.key} · {item.type}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`分支 ${index + 1} 条件 ${i + 1} 运算`}
                  className={control}
                  value={condition.operator}
                  onChange={(event) =>
                    change(rule(condition.input, field?.type ?? "string", event.target.value))
                  }
                >
                  {!operators(field?.type ?? "string").includes(condition.operator) && (
                    <option value={condition.operator}>原运算不适用</option>
                  )}
                  {operators(field?.type ?? "string").map((op) => (
                    <option key={op} value={op}>
                      {labels[op]}
                    </option>
                  ))}
                </select>
                {binary(condition.operator) &&
                  (field?.type === "boolean" ? (
                    <select
                      aria-label={`分支 ${index + 1} 条件 ${i + 1} 比较值`}
                      className={control}
                      value={String(condition.value)}
                      onChange={(event) =>
                        change({ ...condition, value: event.target.value === "true" })
                      }
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input
                      aria-label={`分支 ${index + 1} 条件 ${i + 1} 比较值`}
                      className={control}
                      type={field?.type === "number" ? "number" : "text"}
                      step="any"
                      maxLength={16000}
                      value={String(condition.value ?? "")}
                      onChange={(event) =>
                        change({
                          ...condition,
                          value:
                            field?.type === "number"
                              ? Number(event.target.value)
                              : event.target.value,
                        })
                      }
                    />
                  ))}
                <button
                  className={action}
                  disabled={branch.conditions.length <= 1}
                  onClick={() =>
                    replace(index, {
                      ...branch,
                      conditions: branch.conditions.filter((_, j) => j !== i),
                    })
                  }
                >
                  移除条件
                </button>
              </div>
            );
          })}
          <button
            className={action}
            disabled={branch.conditions.length >= 16 || !data.fields.length}
            onClick={() =>
              replace(index, {
                ...branch,
                conditions: [...branch.conditions, rule(data.fields[0].key, data.fields[0].type)],
              })
            }
          >
            ＋ 添加条件
          </button>
        </div>
      ))}
      <button
        className={action}
        disabled={cases.length >= 8 || !data.fields.length}
        onClick={() => {
          let i = cases.length + 1;
          while (cases.some((item) => item.key === `case${i}`)) i++;
          onChange({
            ...data,
            cases: [
              ...cases,
              {
                key: `case${i}`,
                label: `分支 ${i}`,
                match: "all",
                conditions: [rule(data.fields[0].key, data.fields[0].type)],
              },
            ],
          });
        }}
      >
        ＋ ELSE IF 分支
      </button>
      <div className="rounded-lg border border-dashed p-3 text-xs">
        ELSE · 默认分支（以上均不满足）
      </div>
    </section>
  );
}

/** 执行条件绑定真实控制边；可选数据值不是执行许可，不用真假字符串混充连线。 */
export function V2ExecutionGate({
  node,
  graph,
  onBind,
}: {
  node: WorkflowV2Node;
  graph: WorkflowV2Graph;
  onBind: (key: string, source: string, port: string) => void;
}) {
  const edge = graph.edges.find(
    (item) => item.target === node.id && item.targetHandle === CONTROL_PORT,
  );
  const without = { ...graph, edges: graph.edges.filter((item) => item !== edge) };
  const choices = graph.nodes
    .filter((source) => source.type === "condition" || source.type === "intentClassify")
    .flatMap((source) =>
      branchPorts(source.data)
        .filter((port) =>
          canConnect(without, {
            source: source.id,
            sourceHandle: port.key,
            target: node.id,
            targetHandle: CONTROL_PORT,
          }),
        )
        .map((port) => ({
          value: JSON.stringify([source.id, port.key]),
          label: `${source.data.title || NODE_LABELS[source.type!]} · ${port.label}`,
        })),
    );
  const value = edge ? JSON.stringify([edge.source, edge.sourceHandle]) : "";
  return (
    <label className="block space-y-1 text-xs">
      执行条件
      <select
        aria-label="执行条件"
        className={control}
        value={value}
        onChange={(event) => {
          const pair = event.target.value
            ? (JSON.parse(event.target.value) as [string, string])
            : ["", ""];
          onBind(CONTROL_PORT, pair[0], pair[1]);
        }}
      >
        <option value="">无直接条件（仍需上游数据就绪）</option>
        {value && !choices.some((item) => item.value === value) && (
          <option value={value}>原分支失效，请重新选择</option>
        )}
        {choices.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
