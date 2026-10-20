"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as adminApi from "@/features/admin/api";
import type { WorkflowEditorSource } from "./editor-types";
import type { MediaDraft } from "./use-media-draft";
import { useCommandLock } from "./use-command-lock";

export function useTemplateActions(
  source: WorkflowEditorSource,
  draft: MediaDraft,
  active: boolean,
  setError: (value: string | null) => void,
) {
  const router = useRouter();
  const lock = useCommandLock<"publish" | "metadata">(source.id);
  const [metadataOpen, setMetadataOpen] = useState(false);
  async function publish() {
    if (source.kind !== "template" || active) return;
    const lease = lock.acquire("publish");
    if (!lease) return;
    setError(null);
    try {
      if (!(await draft.save()) || !lease.current()) return;
      await adminApi.publishWorkflowTemplate(source.id);
      if (lease.current()) router.push("/admin?tab=workflowTemplates");
    } catch (reason) {
      if (lease.current())
        setError(
          reason instanceof adminApi.AdminApiError && reason.details.length
            ? reason.details.join("；")
            : reason instanceof Error
              ? reason.message
              : "发布模板失败",
        );
    } finally {
      lease.release();
    }
  }
  async function openMetadata() {
    if (source.kind !== "template" || active) return;
    const lease = lock.acquire("metadata");
    if (!lease) return;
    try {
      if ((await draft.save()) && lease.current()) setMetadataOpen(true);
    } finally {
      lease.release();
    }
  }
  return {
    publishing: lock.pending === "publish",
    metadataOpen,
    setMetadataOpen,
    publish,
    openMetadata,
  };
}
