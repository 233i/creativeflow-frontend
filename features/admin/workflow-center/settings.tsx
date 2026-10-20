"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { WorkflowDocument } from "@/features/workflow/api";
import type { WorkflowTemplateDocument } from "@/features/workflow/templates-api";
import { updateWorkflowTemplate } from "../api";
import { isTypedWorkflowGraph } from "@/features/workflow/types";

/** 元数据保留原显式保存策略；类型不可切换，修改不会暗中发布或扩展资源授权。 */
export function WorkflowSettings({
  document,
  template,
  onSaveName,
  onSaved,
  register,
  onDelete,
  deleteDisabled,
}: {
  document: WorkflowDocument;
  template?: WorkflowTemplateDocument;
  onSaveName: (name: string) => Promise<boolean>;
  onSaved: (value: WorkflowDocument) => void;
  register: (dirty: boolean, save: (() => Promise<boolean>) | null) => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
}) {
  const [name, setName] = useState(document.name);
  const [description, setDescription] = useState(template?.description ?? "");
  const [category, setCategory] = useState(template?.category ?? "");
  const [tags, setTags] = useState(template?.tags.join(", ") ?? "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const save = useCallback(async () => {
    if (lock.current) return false;
    if (!name.trim()) {
      setError("名称不能为空。");
      return false;
    }
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      if (template)
        onSaved(
          await updateWorkflowTemplate(template.id, {
            name: name.trim(),
            description: description.trim(),
            category: category.trim() || "其他",
            tags: tags
              .split(/[,，]/)
              .map((value) => value.trim())
              .filter(Boolean),
          }),
        );
      else if (!(await onSaveName(name.trim()))) {
        setError("保存失败，当前输入已保留。请查看编辑器错误后重试。");
        return false;
      }
      setDirty(false);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败，输入已保留。");
      return false;
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }, [name, template, onSaved, description, category, tags, onSaveName]);
  const ref = useRef(save);
  useEffect(() => {
    ref.current = save;
  });
  useEffect(() => {
    register(dirty, () => ref.current());
    return () => register(false, null);
  }, [dirty, register]);
  return (
    <form
      className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">基本设置</h2>
        <Button type="submit" isDisabled={saving || !dirty}>
          {saving ? "保存中…" : "保存设置"}
        </Button>
      </header>
      {document.copyOrigin && (
        <p className="rounded border p-3">
          复制来源：
          <a
            className="text-primary underline"
            href={`/admin/workflows/${encodeURIComponent(document.copyOrigin.id)}/edit?source=${document.copyOrigin.source}`}
          >
            {document.copyOrigin.source === "template" ? "历史模板" : "后台工作流"} ·{" "}
            {document.copyOrigin.id.slice(0, 8)}
          </a>
          。来源删除或不可访问时，副本仍独立保留。
        </p>
      )}
      <dl className="grid gap-3 border-b pb-4 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">完整 ID</dt>
          <dd className="mt-1 break-all font-mono" tabIndex={0}>
            {document.id}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">类型</dt>
          <dd className="mt-1">
            {isTypedWorkflowGraph(document.graph) ? "通用编排" : "媒体创作"} · 创建后不可直接切换
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">来源</dt>
          <dd className="mt-1">{template ? "历史模板来源" : "管理工作流"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">更新时间</dt>
          <dd className="mt-1">{new Date(document.updatedAt).toLocaleString()}</dd>
        </div>
      </dl>
      <fieldset disabled={saving} className="space-y-4">
        <label className="grid gap-1.5">
          工作流名称
          <input
            className="sol-admin-control w-full"
            aria-invalid={!!error && !name.trim()}
            value={name}
            maxLength={200}
            onChange={(event) => {
              setName(event.target.value);
              setDirty(true);
            }}
          />
          {error && !name.trim() && <span className="text-destructive">名称不能为空。</span>}
        </label>
        {template ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 sm:col-span-2">
              用途说明
              <textarea
                className="sol-admin-control h-auto w-full"
                rows={3}
                value={description}
                maxLength={2000}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setDirty(true);
                }}
              />
            </label>
            <label className="grid gap-1.5">
              分类
              <input
                className="sol-admin-control"
                value={category}
                maxLength={80}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setDirty(true);
                }}
              />
            </label>
            <label className="grid gap-1.5">
              标签（逗号分隔）
              <input
                className="sol-admin-control"
                value={tags}
                onChange={(event) => {
                  setTags(event.target.value);
                  setDirty(true);
                }}
              />
            </label>
          </div>
        ) : (
          <p className="text-muted-foreground">
            API 用途说明在“发布与版本”中管理；修改名称不会自动发布新版本。
          </p>
        )}
      </fieldset>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <p role="status" className="text-muted-foreground">
        {dirty ? "有未保存修改" : "已保存"}
      </p>
      {onDelete && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/25 p-4">
          <div>
            <h3 className="font-medium">删除工作流</h3>
            <p className="mt-1 text-muted-foreground">
              先查看影响并确认；生成素材、运行历史和审计记录保留。
            </p>
          </div>
          <Button variant="destructive" isDisabled={saving || deleteDisabled} onPress={onDelete}>
            删除工作流
          </Button>
        </section>
      )}
    </form>
  );
}
