"use client";
import { listWorkflowApis, type ManagedWorkflowApi } from "@/features/admin/workflow-api";
import { knowledgeAccessApi, type KnowledgeGrants } from "@/features/knowledge/access-api";
import { listApiKeys, type WorkflowApiKey } from "@/features/workflow/external-api/api";
import { useEffect, useRef, useState } from "react";

export function useKnowledgeKeyPermissions({ libraryId }: { libraryId: string }) {
  const [workflows, setWorkflows] = useState<ManagedWorkflowApi[]>([]);
  const [workflow, setWorkflow] = useState("");
  const [keys, setKeys] = useState<WorkflowApiKey[]>([]);
  const [keyId, setKeyId] = useState("");
  const [data, setData] = useState<KnowledgeGrants | null>(null);
  const [pending, setPending] = useState<{ id: string; name: string; enabled: boolean } | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);
  const aliveRef = useRef(true);
  useEffect(() => {
    let disposed = false;
    aliveRef.current = true;
    void Promise.all([listWorkflowApis(), knowledgeAccessApi.grants(libraryId)])
      .then(([apis, value]) => {
        if (!disposed) {
          setWorkflows(apis.apis);
          setData(value);
        }
      })
      .catch(() => {
        if (!disposed) setError("读取工作流或 Key 授权失败，请重新进入此页。");
      });
    return () => {
      disposed = true;
      aliveRef.current = false;
    };
  }, [libraryId]);
  useEffect(() => {
    if (!workflow) return;
    let disposed = false;
    void listApiKeys(workflow)
      .then((value) => {
        const now = Date.now();
        if (!disposed)
          setKeys(
            value.apiKeys.filter(
              (key) =>
                key.enabled &&
                !key.revokedAt &&
                (!key.expiresAt || Date.parse(key.expiresAt) > now),
            ),
          );
      })
      .catch(() => {
        if (!disposed) setError("Key 列表读取失败，请重新选择工作流。");
      })
      .finally(() => {
        if (!disposed) setLoadingKeys(false);
      });
    return () => {
      disposed = true;
    };
  }, [workflow]);
  async function confirm() {
    if (lockRef.current || !pending || !reason.trim()) return;
    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await knowledgeAccessApi.setApiKeyGrant(
        libraryId,
        pending.id,
        pending.enabled,
        reason.trim(),
      );
      if (aliveRef.current) {
        setPending(null);
        setReason("");
        setKeyId("");
      }
      const value = await knowledgeAccessApi.grants(libraryId);
      if (aliveRef.current) setData(value);
    } catch (cause) {
      if (aliveRef.current) setError(cause instanceof Error ? cause.message : "授权未完成。");
    } finally {
      lockRef.current = false;
      if (aliveRef.current) setBusy(false);
    }
  }
  const selected = keys.find((key) => key.id === keyId);

  return {
    libraryId,
    workflows,
    setWorkflows,
    workflow,
    setWorkflow,
    keys,
    setKeys,
    keyId,
    setKeyId,
    data,
    setData,
    pending,
    setPending,
    reason,
    setReason,
    busy,
    setBusy,
    loadingKeys,
    setLoadingKeys,
    error,
    setError,
    lockRef,
    aliveRef,
    confirm,
    selected,
  };
}
export type KnowledgeKeyPermissionsController = ReturnType<typeof useKnowledgeKeyPermissions>;
