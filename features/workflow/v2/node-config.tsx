"use client";

import { V2ExecutionGate } from "./branch-config";
import {
  canConnect,
  FIELD_TYPES,
  NODE_LABELS,
  NODE_DEFINITIONS,
  nodeInputLabel,
  outputFields,
  usesModel,
  type FieldType,
  type WorkflowField,
  type WorkflowV2Graph,
  type WorkflowV2Node,
  type WorkflowV2NodeData,
} from "./types";
import { NodeTypeConfig } from "./node-configurations";
import { controlClass, actionClass } from "./config-styles";
export { controlClass, actionClass } from "./config-styles";
import { SchemaValueEditor } from "./schema-editor";
import { ImageValuePicker, parseImageValue } from "./image-value-picker";
import { RetryConfig } from "./retry-config";

const FIELD_HEADINGS: Partial<Record<WorkflowV2Node["type"], string>> = {
  start: "外部输入字段",
  end: "最终输出字段",
  merge: "汇合输出字段",
};

export function V2NodeConfig({
  node,
  graph,
  onChange,
  onBind,
  onRemove,
  admin = false,
}: {
  node: WorkflowV2Node;
  graph: WorkflowV2Graph;
  onChange: (data: WorkflowV2NodeData) => void;
  onBind: (
    key: string,
    source: string,
    sourceHandle: string,
    additional?: [string, string][],
  ) => void;
  onRemove: () => void;
  admin?: boolean;
}) {
  const { type: kind, data } = node;
  const knowledge = kind === "knowledgeRetrieve" || kind === "knowledgeAnswer";
  const fixedFields = NODE_DEFINITIONS[kind].fixedFields;
  function changeField(index: number, field: WorkflowField) {
    onChange({ ...data, fields: data.fields.map((current, i) => (i === index ? field : current)) });
  }
  return (
    <div className="space-y-5 p-4">
      <header>
        <h2 className="text-sm font-semibold">{NODE_LABELS[kind]}配置</h2>
        <p className="mt-1 text-xs text-muted-foreground">修改后保存；不影响已提交的运行。</p>
      </header>
      <label className="block space-y-1 text-xs">
        节点名称
        <input
          aria-label="节点名称"
          className={controlClass}
          maxLength={100}
          value={data.title ?? ""}
          placeholder={NODE_LABELS[kind]}
          onChange={(event) => onChange({ ...data, title: event.target.value })}
        />
      </label>
      <NodeTypeConfig node={node} slot="before-gate" admin={admin} onChange={onChange} />
      {NODE_DEFINITIONS[kind].acceptsControl && (
        <V2ExecutionGate node={node} graph={graph} onBind={onBind} />
      )}
      <NodeTypeConfig node={node} slot="after-gate" admin={admin} onChange={onChange} />
      {kind !== "start" && kind !== "end" && (
        <RetryConfig data={data} onChange={(next) => onChange(next as WorkflowV2NodeData)} />
      )}
      <fieldset className="space-y-3">
        <legend className="mb-2 text-xs font-semibold">{FIELD_HEADINGS[kind] ?? "节点输入"}</legend>
        {data.fields.map((field, index) => {
          const connections = graph.edges.filter(
            (edge) => edge.target === node.id && edge.targetHandle === field.key,
          );
          const connection = connections[0];
          const withoutCurrent = {
            ...graph,
            edges: graph.edges.filter((edge) => !connections.includes(edge)),
          };
          const choices = graph.nodes.flatMap((source) =>
            outputFields(source)
              .filter((output) =>
                canConnect(withoutCurrent, {
                  source: source.id,
                  sourceHandle: output.key,
                  target: node.id,
                  targetHandle: field.key,
                }),
              )
              .map((output) => ({
                value: JSON.stringify([source.id, output.key]),
                label: `${source.data.title || NODE_LABELS[source.type!]} · ${output.key}`,
              })),
          );
          return (
            <div key={index} className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">字段 {index + 1}</span>
                <button
                  aria-label={`删除字段 ${index + 1}`}
                  className="text-xs text-destructive"
                  disabled={fixedFields || data.fields.length <= 1}
                  onClick={() =>
                    onChange({ ...data, fields: data.fields.filter((_, i) => i !== index) })
                  }
                >
                  删除
                </button>
              </div>
              <label className="block text-xs">
                标识
                <input
                  disabled={fixedFields}
                  aria-label={`字段 ${index + 1} 标识`}
                  className={controlClass}
                  maxLength={48}
                  value={field.key}
                  onChange={(event) => changeField(index, { ...field, key: event.target.value })}
                />
              </label>
              <label className="block text-xs">
                显示名称
                <input
                  disabled={fixedFields}
                  aria-label={`字段 ${index + 1} 名称`}
                  className={controlClass}
                  maxLength={100}
                  value={knowledge ? nodeInputLabel(kind, field) : (field.label ?? "")}
                  onChange={(event) => changeField(index, { ...field, label: event.target.value })}
                />
              </label>
              {knowledge && field.key === "question" && (
                <p className="text-[11px] leading-5 text-muted-foreground">
                  {kind === "knowledgeRetrieve"
                    ? "连接原始问题或参数提取、查询改写的输出，用于向量检索。"
                    : "连接需要回答的完整问题，不必与检索词相同。"}{" "}
                  1–2000 字符，不能全为空白；标识 question 保持不变。
                </p>
              )}
              <div className="flex gap-2">
                <select
                  disabled={fixedFields}
                  aria-label={`字段 ${index + 1} 类型`}
                  className={controlClass}
                  value={field.type}
                  onChange={(event) =>
                    changeField(index, {
                      key: field.key,
                      label: field.label,
                      required: field.required,
                      type: event.target.value as FieldType,
                    })
                  }
                >
                  {[
                    ...FIELD_TYPES,
                    ...(kind === "end" || kind === "condition" || kind === "merge" || knowledge
                      ? ["contextChunks", "answer"]
                      : []),
                  ].map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
                <label className="flex shrink-0 items-center gap-1 text-xs">
                  <input
                    disabled={fixedFields}
                    type="checkbox"
                    checked={field.required}
                    onChange={(event) =>
                      changeField(index, { ...field, required: event.target.checked })
                    }
                  />
                  必填
                </label>
              </div>
              {field.type === "string" && !fixedFields && (
                <label className="block text-xs">
                  最大字符数
                  <input
                    aria-label={`字段 ${index + 1} 最大字符数`}
                    type="number"
                    min={1}
                    max={1048576}
                    className={controlClass}
                    value={field.maxLength ?? 1048576}
                    onChange={(event) =>
                      changeField(index, {
                        ...field,
                        maxLength: event.target.value ? Number(event.target.value) : undefined,
                      })
                    }
                  />
                </label>
              )}
              {!fixedFields && field.type !== "contextChunks" && field.type !== "answer" && (
                <details>
                  <summary className="cursor-pointer text-xs text-primary">
                    字段约束与嵌套结构
                  </summary>
                  <div className="mt-2">
                    <SchemaValueEditor
                      hideType
                      field={field}
                      onChange={(next) => changeField(index, next)}
                    />
                  </div>
                </details>
              )}
              {!fixedFields && ["string", "number", "boolean", "image"].includes(field.type) && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      aria-label={`字段 ${index + 1} 使用默认值`}
                      checked={"default" in field}
                      onChange={(event) => {
                        const next = { ...field };
                        if (event.target.checked)
                          next.default =
                            field.type === "string"
                              ? ""
                              : field.type === "number"
                                ? 0
                                : field.type === "boolean"
                                  ? false
                                  : { assetId: "" };
                        else delete next.default;
                        changeField(index, next);
                      }}
                    />
                    无来源值时使用默认值
                  </label>
                  {"default" in field && field.type === "image" ? (
                    <ImageValuePicker
                      label={`字段 ${index + 1} 默认图片`}
                      value={parseImageValue(field.default)}
                      onChange={(value) =>
                        changeField(index, { ...field, default: value ?? undefined })
                      }
                    />
                  ) : (
                    "default" in field &&
                    (field.type === "boolean" ? (
                      <select
                        aria-label={`字段 ${index + 1} 默认值`}
                        className={controlClass}
                        value={String(field.default)}
                        onChange={(event) =>
                          changeField(index, { ...field, default: event.target.value === "true" })
                        }
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : (
                      <input
                        aria-label={`字段 ${index + 1} 默认值`}
                        className={controlClass}
                        type={field.type === "number" ? "number" : "text"}
                        step="any"
                        value={String(field.default ?? "")}
                        maxLength={field.maxLength ?? 1048576}
                        onChange={(event) =>
                          changeField(index, {
                            ...field,
                            default:
                              field.type === "number"
                                ? Number(event.target.value)
                                : event.target.value,
                          })
                        }
                      />
                    ))
                  )}
                </div>
              )}
              {kind === "merge" ? (
                <fieldset className="space-y-2">
                  <legend className="text-xs">互斥变量来源（可多选）</legend>
                  <div className="max-h-48 space-y-2 overflow-auto rounded-lg border p-2">
                    {choices.map((choice) => (
                      <label key={choice.value} className="flex items-start gap-2 text-xs">
                        <input
                          type="checkbox"
                          aria-label={`字段 ${index + 1} 来源 ${choice.label}`}
                          checked={connections.some(
                            (edge) =>
                              JSON.stringify([edge.source, edge.sourceHandle]) === choice.value,
                          )}
                          onChange={(event) => {
                            const current = connections.map(
                              (edge) => [edge.source, edge.sourceHandle] as [string, string],
                            );
                            const next = event.target.checked
                              ? [...current, JSON.parse(choice.value) as [string, string]]
                              : current.filter((pair) => JSON.stringify(pair) !== choice.value);
                            onBind(
                              field.key,
                              next[0]?.[0] ?? "",
                              next[0]?.[1] ?? "",
                              next.slice(1),
                            );
                          }}
                        />
                        {choice.label}
                      </label>
                    ))}
                    {!choices.length && (
                      <p className="text-xs text-muted-foreground">暂无类型匹配的来源。</p>
                    )}
                    {connections
                      .filter(
                        (edge) =>
                          !choices.some(
                            (choice) =>
                              choice.value === JSON.stringify([edge.source, edge.sourceHandle]),
                          ),
                      )
                      .map((edge) => (
                        <button
                          key={edge.id}
                          className="text-xs text-destructive"
                          onClick={() => {
                            const next = connections
                              .filter((item) => item !== edge)
                              .map((item) => [item.source, item.sourceHandle] as [string, string]);
                            onBind(
                              field.key,
                              next[0]?.[0] ?? "",
                              next[0]?.[1] ?? "",
                              next.slice(1),
                            );
                          }}
                        >
                          移除失效连线 {edge.source}
                        </button>
                      ))}
                  </div>
                </fieldset>
              ) : (
                kind !== "start" && (
                  <label className="block text-xs">
                    变量来源
                    <select
                      aria-label={`字段 ${index + 1} 变量来源`}
                      className={controlClass}
                      value={
                        connection
                          ? JSON.stringify([connection.source, connection.sourceHandle])
                          : ""
                      }
                      onChange={(event) => {
                        const value = event.target.value
                          ? (JSON.parse(event.target.value) as [string, string])
                          : ["", ""];
                        onBind(field.key, value[0], value[1]);
                      }}
                    >
                      <option value="">未连接</option>
                      {connection &&
                        !choices.some(
                          (choice) =>
                            choice.value ===
                            JSON.stringify([connection.source, connection.sourceHandle]),
                        ) && (
                          <option
                            value={JSON.stringify([connection.source, connection.sourceHandle])}
                          >
                            连线已失效，请重新选择
                          </option>
                        )}
                      {choices.map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )
              )}
            </div>
          );
        })}
        <button
          className={actionClass}
          disabled={fixedFields || data.fields.length >= 16}
          onClick={() => {
            let suffix = data.fields.length + 1;
            while (data.fields.some((field) => field.key === `field${suffix}`)) suffix++;
            onChange({
              ...data,
              fields: [
                ...data.fields,
                { key: `field${suffix}`, label: "", type: "string", required: true },
              ],
            });
          }}
        >
          ＋ 添加字段
        </button>
        {usesModel(kind) &&
          kind !== "knowledgeAnswer" &&
          !data.fields.some((field) => field.type === "image") && (
            <button
              className={`${actionClass} ml-2`}
              disabled={fixedFields || data.fields.length >= 16}
              onClick={() => {
                let key = "image";
                let suffix = 2;
                while (data.fields.some((field) => field.key === key)) key = `image${suffix++}`;
                onChange({
                  ...data,
                  fields: [
                    ...data.fields,
                    { key, label: "参考图片", type: "image", required: false },
                  ],
                });
              }}
            >
              ＋ 添加图片输入
            </button>
          )}
        <p className="text-[11px] text-muted-foreground">
          修改标识或类型后，请检查连线与提示词变量。每个普通字段最多 1 MiB，节点合计最多 2
          MiB；知识证据按检索节点的片段数量配置交付。可在字段约束中声明对象子字段与数组元素。
        </p>
      </fieldset>
      {kind !== "start" && kind !== "end" && (
        <button className={`${actionClass} text-destructive`} onClick={onRemove}>
          删除此 {NODE_LABELS[kind]} 节点
        </button>
      )}
    </div>
  );
}
