"use client";
import * as adminApi from "@/features/admin/api";
import { type DetailSection } from "@/features/admin/workflow-center/detail-context";
import type { WorkflowTemplateDocument } from "@/features/workflow/templates-api";
import { useRef, useState } from "react";

export function useTemplatePublication({
  template,
  section,
  onChange,
  beforePublish,
}: {
  template: WorkflowTemplateDocument;
  section: DetailSection;
  onChange: (value: WorkflowTemplateDocument) => void;
  beforePublish?: () => Promise<boolean>;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);
  async function apply() {
    if (lockRef.current) return;
    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      if (template.status !== "published" && beforePublish && !(await beforePublish())) return;
      onChange(
        await (template.status === "published"
          ? adminApi.archiveWorkflowTemplate(template.id)
          : adminApi.publishWorkflowTemplate(template.id)),
      );
      setConfirm(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "发布状态不明确，请重新查询后确认。");
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  }
  return { template, section, confirm, setConfirm, busy, setBusy, error, setError, lockRef, apply };
}
export type TemplatePublicationController = ReturnType<typeof useTemplatePublication>;
