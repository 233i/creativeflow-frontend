"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as adminApi from "@/features/admin/api";
import type { WorkflowTemplateDocument } from "@/features/workflow/templates-api";

interface MetadataDraft {
  name: string;
  description: string;
  category: string;
  tags: string;
  isFeatured: boolean;
  sortOrder: string;
}

export function WorkflowTemplateMetadataDialog({
  template,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  template: WorkflowTemplateDocument;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (template: WorkflowTemplateDocument) => void;
}) {
  const [draft, setDraft] = useState<MetadataDraft>(() => toDraft(template));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (saving) return;
    if (!draft.name.trim()) {
      setError("请输入模板名称");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await adminApi.updateWorkflowTemplate(template.id, {
        name: draft.name.trim(),
        description: draft.description.trim(),
        category: draft.category.trim() || "其他",
        tags: draft.tags
          .split(/[,，]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
        isFeatured: draft.isFeatured,
        sortOrder: Number(draft.sortOrder) || 0,
      });
      onSaved(saved);
      onOpenChange(false);
    } catch (reason) {
      setError(apiErrorMessage(reason, "保存模板信息失败"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      key={`${template.id}:${template.updatedAt}`}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!saving) onOpenChange(open);
      }}
      isDismissable={!saving}
      className="sm:max-w-xl"
    >
      <DialogHeader>
        <DialogTitle>模板信息</DialogTitle>
        <DialogDescription>
          设置模板库中展示的名称、分类和推荐顺序。工作流结构会在画布中自动保存。
        </DialogDescription>
      </DialogHeader>

      <div className="grid max-h-[65vh] gap-4 overflow-y-auto py-1 sm:grid-cols-2">
        <Field label="模板名称" htmlFor="workflow-template-name" required>
          <Input
            id="workflow-template-name"
            value={draft.name}
            maxLength={200}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </Field>
        <Field label="分类" htmlFor="workflow-template-category">
          <Input
            id="workflow-template-category"
            value={draft.category}
            maxLength={80}
            placeholder="例如：电商、社媒、视频"
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
          />
        </Field>
        <Field label="模板描述" htmlFor="workflow-template-description" className="sm:col-span-2">
          <Textarea
            id="workflow-template-description"
            value={draft.description}
            maxLength={2000}
            placeholder="说明模板适合什么场景，以及用户需要替换哪些输入。"
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </Field>
        <Field label="标签" htmlFor="workflow-template-tags">
          <Input
            id="workflow-template-tags"
            value={draft.tags}
            placeholder="用逗号分隔，最多 10 个"
            onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
          />
        </Field>
        <Field label="排序权重" htmlFor="workflow-template-sort-order">
          <Input
            id="workflow-template-sort-order"
            type="number"
            min={-100000}
            max={100000}
            value={draft.sortOrder}
            onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={draft.isFeatured}
            onChange={(event) => setDraft({ ...draft, isFeatured: event.target.checked })}
          />
          在前台模板库中推荐展示
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive sm:col-span-2">
            {error}
          </p>
        )}
      </div>

      <DialogFooter>
        <DialogClose variant="outline" isDisabled={saving}>
          取消
        </DialogClose>
        <Button isDisabled={saving} onPress={() => void save()}>
          {saving ? "保存中…" : "保存信息"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1.5">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function toDraft(template: WorkflowTemplateDocument): MetadataDraft {
  return {
    name: template.name,
    description: template.description,
    category: template.category,
    tags: template.tags.join(", "),
    isFeatured: template.isFeatured,
    sortOrder: String(template.sortOrder),
  };
}

function apiErrorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof adminApi.AdminApiError && reason.details.length > 0) {
    return reason.details.join("；");
  }
  return reason instanceof Error ? reason.message : fallback;
}
