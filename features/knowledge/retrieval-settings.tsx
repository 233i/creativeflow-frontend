"use client";

import { InputNumber, Select } from "tdesign-react";
import "tdesign-react/es/style/index.css";
import { useAiStore } from "@/features/ai/store";
import { resolveProtocol } from "@/features/ai/types";
import { retrievalError, type RetrievalSettings } from "./retrieval-types";

export function RetrievalSelect<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <label className="block space-y-1.5 text-xs">
      <span>{label}</span>
      <Select
        value={value}
        options={options}
        disabled={disabled}
        style={{ width: "100%" }}
        inputProps={{ name: label }}
        onChange={(next) => {
          const option = options.find((item) => item.value === next);
          if (option) onChange(option.value);
        }}
      />
    </label>
  );
}
export function RetrievalNumber({
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  optional,
  onChange,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  optional?: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="block space-y-1.5 text-xs">
      <span>{label}</span>
      <InputNumber
        value={value === null || !Number.isFinite(value) ? "" : value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        theme="normal"
        style={{ width: "100%" }}
        inputProps={{ name: label, placeholder: optional ? "不设置阈值" : "" }}
        onChange={(next) => onChange(next === "" ? (optional ? null : Number.NaN) : Number(next))}
      />
    </label>
  );
}
/** 后台测试和工作流节点共享同一套控件与校验。 */
export function RetrievalSettingsForm({
  value,
  onChange,
  disabled = false,
  hybridAvailable = true,
}: {
  value: RetrievalSettings;
  onChange: (value: RetrievalSettings) => void;
  disabled?: boolean;
  hybridAvailable?: boolean;
}) {
  const providers = useAiStore((state) => state.providers);
  const models = providers
    .filter((provider) => provider.enabled)
    .flatMap((provider) =>
      provider.models
        .filter(
          (model) =>
            model.enabled &&
            model.category === "rerank" &&
            resolveProtocol(provider, model) === "rerank",
        )
        .map((model) => ({ value: model.id, label: provider.name + " / " + model.name })),
    );
  const modelOptions = [{ value: "", label: "不启用重排序" }, ...models];
  if (value.rerankModelId && !models.some((model) => model.value === value.rerankModelId))
    modelOptions.push({ value: value.rerankModelId, label: "原模型不可用，请重新选择" });
  const change = <K extends keyof RetrievalSettings>(key: K, next: RetrievalSettings[K]) =>
    onChange({ ...value, [key]: next });
  const error = retrievalError(value, hybridAvailable);
  const countWarning = value.maxContextChunks < value.topK;
  return (
    <section className="space-y-4" aria-label="检索策略配置">
      <RetrievalSelect
        label="检索方式"
        value={value.mode}
        disabled={disabled}
        options={[
          { value: "vector", label: "向量检索" },
          { value: "keyword", label: "关键词 BM25", disabled: !hybridAvailable },
          { value: "hybrid", label: "混合检索 · RRF 融合", disabled: !hybridAvailable },
        ]}
        onChange={(next) => change("mode", next)}
      />
      {!hybridAvailable && (
        <p className="text-xs text-amber-700">
          该固定版本只有向量索引；在版本管理中重建候选并激活，然后重新选择新版本。
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <RetrievalNumber
          label="向量候选数"
          value={value.denseCandidates}
          min={1}
          max={64}
          disabled={disabled || value.mode === "keyword"}
          onChange={(next) => change("denseCandidates", Number(next))}
        />
        <RetrievalNumber
          label="关键词候选数"
          value={value.keywordCandidates}
          min={1}
          max={64}
          disabled={disabled || value.mode === "vector"}
          onChange={(next) => change("keywordCandidates", Number(next))}
        />
        <RetrievalNumber
          label="主命中数 TopK"
          value={value.topK}
          min={1}
          max={32}
          disabled={disabled}
          onChange={(next) => change("topK", Number(next))}
        />
        <RetrievalNumber
          label="最终交付片段数"
          value={value.maxContextChunks}
          min={1}
          max={32}
          disabled={disabled}
          onChange={(next) => change("maxContextChunks", Number(next))}
        />
        <RetrievalNumber
          label="最低 Cosine 分数"
          value={value.minVectorScore}
          min={-1}
          max={1}
          step={0.05}
          disabled={disabled || value.mode === "keyword"}
          onChange={(next) => change("minVectorScore", Number(next))}
        />
        <RetrievalNumber
          label="前后相邻补充范围"
          value={value.neighborRadius}
          min={0}
          max={2}
          disabled={disabled}
          onChange={(next) => change("neighborRadius", Number(next))}
        />
      </div>
      <p className="text-[11px] leading-5 text-muted-foreground">
        主命中与邻接补充合计按交付数量限制，保留完整正文。Cosine 阈值只过滤向量召回，不过滤 BM25 或
        RRF 分数。
      </p>
      {countWarning && (
        <p className="text-xs text-amber-700">
          交付上限小于 TopK，部分主命中也会省略；主命中始终优先于相邻补充。
        </p>
      )}
      <RetrievalSelect
        label="字段名与编码匹配"
        value={value.exactMatch}
        disabled={disabled}
        options={[
          { value: "prefer", label: "优先保留精确标识候选" },
          { value: "require", label: "必须命中全部标识" },
          { value: "off", label: "关闭精确标识策略" },
        ]}
        onChange={(next) => change("exactMatch", next)}
      />
      <p className="text-[11px] text-muted-foreground">
        下划线字段名、混合字母数字编码及引号/反引号中的名称会被保护；原始问题可连入 originalQuestion
        端口，避免改写丢失标识。
      </p>
      <RetrievalSelect
        label="重排序模型"
        value={value.rerankModelId ?? ""}
        disabled={disabled}
        options={modelOptions}
        onChange={(next) =>
          onChange({
            ...value,
            rerankModelId: next || null,
            minRerankScore: next ? value.minRerankScore : null,
          })
        }
      />
      {value.rerankModelId && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <RetrievalNumber
              label="重排候选数"
              value={value.rerankCandidates}
              min={1}
              max={64}
              disabled={disabled}
              onChange={(next) => change("rerankCandidates", Number(next))}
            />
            <RetrievalNumber
              label="最低重排分数"
              value={value.minRerankScore}
              min={0}
              max={1}
              step={0.05}
              optional
              disabled={disabled}
              onChange={(next) => change("minRerankScore", next)}
            />
          </div>
          <RetrievalSelect
            label="重排序失败处理"
            value={value.rerankFailurePolicy}
            disabled={disabled}
            options={[
              { value: "fail", label: "中止执行（默认）" },
              { value: "fallback", label: "记录降级并使用召回排名" },
            ]}
            onChange={(next) => change("rerankFailurePolicy", next)}
          />
          <p className="text-[11px] text-amber-700">
            重排序可能产生费用；不自动重试。禁用、撤权或配置变化会阻止执行，不能使用降级绕过。
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
