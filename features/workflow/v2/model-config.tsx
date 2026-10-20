"use client";
import { useAiStore } from "@/features/ai/store";
import { PROTOCOLS_BY_CATEGORY, resolveProtocol } from "@/features/ai/types";
import type { ModelNodeKind, WorkflowV2NodeData } from "./domain/nodes";
import { StructuredConfig } from "./data-task-config";
import { controlClass, actionClass } from "./config-styles";

type ModelConfigProps = {
  [K in ModelNodeKind]: { kind: K; data: WorkflowV2NodeData<K> };
}[ModelNodeKind] & {
  onChange: (data: WorkflowV2NodeData) => void;
};
export function ModelConfig({ kind, data, onChange }: ModelConfigProps) {
  const providers = useAiStore((state) => state.providers);
  const hasImageInput = data.fields.some((field) => field.type === "image");
  const models = providers
    .filter((provider) => provider.enabled)
    .flatMap((provider) =>
      provider.models
        .filter(
          (model) =>
            model.enabled &&
            model.category === "chat" &&
            PROTOCOLS_BY_CATEGORY.chat.some(
              (protocol) => protocol === resolveProtocol(provider, model),
            ),
        )
        .map((model) => ({
          id: model.id,
          label: `${provider.name} / ${model.name}`,
          supportsVision: model.supportsVision === true,
          maxOutputTokens: model.maxOutputTokens,
        })),
    );
  const modelTokenLimit = models.find((model) => model.id === data.modelId)?.maxOutputTokens;
  return (
    <>
      <label className="block space-y-1 text-xs">
        聊天模型
        <select
          aria-label="聊天模型"
          className={controlClass}
          value={data.modelId ?? ""}
          onChange={(event) => onChange({ ...data, modelId: event.target.value })}
        >
          <option value="">请选择聊天模型</option>
          {data.modelId && !models.some((model) => model.id === data.modelId) && (
            <option value={data.modelId}>原模型不可用</option>
          )}
          {models.map((model) => (
            <option
              key={model.id}
              value={model.id}
              disabled={hasImageInput && !model.supportsVision}
            >
              {model.label}
              {hasImageInput && !model.supportsVision ? "（未声明视觉能力）" : ""}
            </option>
          ))}
        </select>
      </label>
      {!models.length && (
        <p className="text-xs text-amber-700">
          请在后台新增聊天渠道和模型；向量模型不能用于 LLM。服务端需允许该模型端点。
        </p>
      )}
      {hasImageInput && models.length > 0 && !models.some((model) => model.supportsVision) && (
        <p className="text-xs text-amber-700">
          当前没有声明支持图片输入的聊天模型，请在后台开启模型的 supportsVision 后再运行。
        </p>
      )}
      <label className="block space-y-1 text-xs">
        系统提示词
        <textarea
          aria-label="系统提示词"
          className={controlClass}
          rows={3}
          maxLength={4000}
          value={data.systemPrompt ?? ""}
          onChange={(event) => onChange({ ...data, systemPrompt: event.target.value })}
        />
      </label>
      {kind !== "knowledgeAnswer" && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-medium">用户提示词（按顺序拼接）</legend>
          {(data.prompt ?? []).map((part, index) => (
            <div key={index} className="flex items-start gap-1">
              {"text" in part ? (
                <textarea
                  aria-label={`提示词文本 ${index + 1}`}
                  rows={2}
                  className={controlClass}
                  maxLength={16000}
                  value={part.text}
                  onChange={(event) =>
                    onChange({
                      ...data,
                      prompt: data.prompt!.map((value, i) =>
                        i === index ? { text: event.target.value } : value,
                      ),
                    })
                  }
                />
              ) : (
                <select
                  aria-label={`提示词变量 ${index + 1}`}
                  className={controlClass}
                  value={part.input}
                  onChange={(event) =>
                    onChange({
                      ...data,
                      prompt: data.prompt!.map((value, i) =>
                        i === index ? { input: event.target.value } : value,
                      ),
                    })
                  }
                >
                  <option value="">选择输入变量</option>
                  {data.fields.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.key}
                    </option>
                  ))}
                </select>
              )}
              <button
                aria-label={`删除提示词片段 ${index + 1}`}
                className={actionClass}
                onClick={() =>
                  onChange({ ...data, prompt: data.prompt!.filter((_, i) => i !== index) })
                }
              >
                ×
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <button
              className={actionClass}
              disabled={(data.prompt?.length ?? 0) >= 32}
              onClick={() => onChange({ ...data, prompt: [...(data.prompt ?? []), { text: "" }] })}
            >
              添加文本
            </button>
            <button
              className={actionClass}
              disabled={(data.prompt?.length ?? 0) >= 32}
              onClick={() =>
                onChange({
                  ...data,
                  prompt: [...(data.prompt ?? []), { input: data.fields[0]?.key ?? "" }],
                })
              }
            >
              插入变量
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            变量来自下方输入的真实连线；对象和数组以 JSON 文本传入。
          </p>
        </fieldset>
      )}
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            {
              key: "maxOutputTokens",
              label: "最大输出 token",
              min: 1,
              max: modelTokenLimit ?? 2147483647,
              step: 1,
            },
            { key: "temperature", label: "温度", min: 0, max: 2, step: 0.1 },
            { key: "timeoutSeconds", label: "超时（秒）", min: 1, max: 300, step: 1 },
          ] as const
        ).map((item) => (
          <label key={item.key} className="space-y-1 text-xs">
            {item.label}
            <input
              aria-label={item.label}
              className={controlClass}
              type="number"
              min={item.min}
              max={item.max}
              step={item.step}
              value={data[item.key] ?? ""}
              onChange={(event) =>
                onChange({
                  ...data,
                  [item.key]: event.target.value === "" ? undefined : Number(event.target.value),
                })
              }
            />
          </label>
        ))}
      </div>
      <p className="text-[11px] leading-5 text-muted-foreground">
        {modelTokenLimit != null
          ? `当前模型配置的输出上限为 ${modelTokenLimit} token。`
          : "模型未配置输出上限，可填写更大的正整数；实际支持范围由模型服务决定。"}{" "}
        思考模型的推理也可能占用输出预算。
      </p>
      {modelTokenLimit != null && (data.maxOutputTokens ?? 0) > modelTokenLimit && (
        <p role="alert" className="text-xs text-amber-700">
          最大输出 token 超过当前模型配置上限，请调整数值或在模型管理中核对上限。
        </p>
      )}
      {kind === "llm" && <StructuredConfig kind={kind} data={data} onChange={onChange} />}
      {kind === "parameterExtract" && (
        <StructuredConfig kind={kind} data={data} onChange={onChange} />
      )}
      {kind === "intentClassify" && (
        <StructuredConfig kind={kind} data={data} onChange={onChange} />
      )}
    </>
  );
}
