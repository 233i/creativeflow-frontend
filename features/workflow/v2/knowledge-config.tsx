"use client";

import { useEffect, useState } from "react";
import { knowledgeAccessApi, type KnowledgeChoice } from "@/features/knowledge/access-api";
import type { WorkflowV2NodeData } from "./types";
import { RetrievalSettingsForm } from "@/features/knowledge/retrieval-settings";
import { applyRetrievalSettings, retrievalNodeSettings } from "./retrieval-node-settings";

/** 只读取已授权目录；选择时固定版本 ID，不在执行时偷偷追随最新版本。 */
export function V2KnowledgeConfig({
  data,
  admin,
  onChange,
}: {
  data: WorkflowV2NodeData<"knowledgeRetrieve">;
  admin: boolean;
  onChange: (data: WorkflowV2NodeData<"knowledgeRetrieve">) => void;
}) {
  const [choices, setChoices] = useState<KnowledgeChoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const control = "w-full rounded-lg border bg-background p-2 text-xs";
  useEffect(() => {
    let disposed = false;
    void knowledgeAccessApi
      .catalog(admin)
      .then((value) => {
        if (!disposed) {
          setChoices(value);
          setError(null);
        }
      })
      .catch(() => {
        if (!disposed) {
          setChoices([]);
          setError("知识目录不可用：请检查登录、授权和开发知识服务。");
        }
      });
    return () => {
      disposed = true;
    };
  }, [admin, revision]);
  const library = choices.find((choice) => choice.id === data.libraryId);
  return (
    <section className="space-y-3 rounded-xl border bg-muted/20 p-3">
      <div className="flex items-center justify-between text-xs">
        <strong>检索资源</strong>
        <button className="text-primary" onClick={() => setRevision((value) => value + 1)}>
          刷新目录
        </button>
      </div>
      <p className="text-[11px] leading-5 text-muted-foreground">
        检索词可以使用参数提取或改写后的文本，不必与知识问答的原始问题相同。结果会保留实际检索词及固定来源，问答仍围绕原始问题回答。
      </p>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <label className="block space-y-1 text-xs">
        知识库
        <select
          aria-label="检索知识库"
          className={control}
          value={data.libraryId ?? ""}
          onChange={(event) => {
            const selected = choices.find((choice) => choice.id === event.target.value);
            onChange({
              ...data,
              libraryId: event.target.value,
              versionId:
                selected?.activeVersion &&
                selected.versions.some((version) => version.id === selected.activeVersion)
                  ? selected.activeVersion
                  : (selected?.versions[0]?.id ?? ""),
            });
          }}
        >
          <option value="">选择已授权知识库</option>
          {data.libraryId && !library && (
            <option value={data.libraryId}>原知识库不可用或已撤权</option>
          )}
          {choices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.name}
            </option>
          ))}
        </select>
      </label>
      {library?.description && (
        <p className="text-xs text-muted-foreground">{library.description}</p>
      )}
      <label className="block space-y-1 text-xs">
        固定索引版本
        <select
          aria-label="固定索引版本"
          className={control}
          value={data.versionId ?? ""}
          onChange={(event) => onChange({ ...data, versionId: event.target.value })}
        >
          <option value="">选择就绪版本</option>
          {data.versionId &&
            !library?.versions.some((version) => version.id === data.versionId) && (
              <option value={data.versionId}>原版本不可用</option>
            )}
          {library?.versions.map((version) => (
            <option key={version.id} value={version.id}>
              {new Date(version.createdAt).toLocaleString()} · {version.id.slice(-6)}
              {version.id === library.activeVersion ? "（当前激活）" : ""}
            </option>
          ))}
        </select>
      </label>
      <RetrievalSettingsForm
        value={retrievalNodeSettings(data)}
        onChange={(value) => onChange(applyRetrievalSettings(data, value))}
        hybridAvailable={
          library?.versions.find((version) => version.id === data.versionId)?.indexSchema ===
          "hybrid-v1"
        }
      />
    </section>
  );
}
