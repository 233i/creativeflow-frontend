"use client";
import { useAdminQuery, workflowReturnUrl } from "@/features/admin/admin-query";
import { type CenterItem } from "@/features/admin/workflow-center/api";
import { type EditorSession } from "@/features/admin/workflow-center/detail-context";
import type { WorkflowDocument } from "@/features/workflow/api";
import type { WorkflowTemplateDocument } from "@/features/workflow/templates-api";
import { useWorkspaceRouter as useRouter } from "@/components/providers/workspace-context";
import { useRef, useState, useSyncExternalStore } from "react";
import { detailSection, subscribe } from "../detail-location";
import type { WorkflowDetailProps } from "../detail-types";
import { useAdminSession } from "../../workspace/session";
import { useWorkspacePage } from "@/components/providers/workspace-context";
export function useDetailState({ id, source, initialSection }: WorkflowDetailProps) {
  const workspace = useWorkspacePage();
  const { identity, setIdentity, checking } = useAdminSession();
  const router = useRouter();
  const [params] = useAdminQuery();
  const returnHref = workflowReturnUrl(params.get("returnTo"));
  const path = useSyncExternalStore(
    subscribe,
    () =>
      workspace
        ? new URL(workspace.href, "http://workspace.local").pathname
        : window.location.pathname,
    () => `/admin/workflows/${id}/${initialSection}`,
  );
  const section = detailSection(path.split("/").filter(Boolean)[3]);
  const [document, setDocument] = useState<WorkflowDocument | WorkflowTemplateDocument | null>(
    null,
  );
  const [item, setItem] = useState<CenterItem | null>(null);
  const [session, setSession] = useState<EditorSession | null>(null);
  const [header, setHeader] = useState<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [formCanSave, setFormCanSave] = useState(false);
  const formSaveRef = useRef<(() => Promise<boolean>) | null>(null);
  const locationBeforePopRef = useRef<{ url: string; state: unknown } | null>(null);
  const navigationGuardRef = useRef({ formDirty: false, formBusy: false, editorDirty: false });
  const current = session?.document ?? document;
  const publishedTemplate =
    source === "template" && document && "status" in document && document.status === "published";

  return {
    id,
    source,
    initialSection,
    router,
    params,
    returnHref,
    path,
    section,
    identity,
    setIdentity,
    checking,
    document,
    setDocument,
    item,
    setItem,
    session,
    setSession,
    header,
    setHeader,
    error,
    setError,
    retry,
    setRetry,
    deleting,
    setDeleting,
    pending,
    setPending,
    leaving,
    setLeaving,
    formDirty,
    setFormDirty,
    formBusy,
    setFormBusy,
    formCanSave,
    setFormCanSave,
    formSaveRef,
    locationBeforePopRef,
    navigationGuardRef,
    current,
    publishedTemplate,
  };
}
export type DetailState = ReturnType<typeof useDetailState>;
