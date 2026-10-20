"use client";
import * as publicationApi from "@/features/workflow/external-api/api";
import { mutationError } from "../publication-errors";
import type { PublicationProps } from "../publication-types";
import type { PublicationQuery } from "./use-publication-query";
import type { PublicationState } from "./use-publication-state";
export function usePublicationCommands(
  props: PublicationProps,
  state: PublicationState,
  query: PublicationQuery,
) {
  const { workflowId, onOpenChange, onBeforePublish } = props;
  const {
    description,
    maxConcurrency,
    keyName,
    setKeyName,
    newSecret,
    setNewSecret,
    setAction,
    setError,
    setCopied,
    mutationRef,
    setInspectedRun,
    setFormDirty,
    setKeyDialog,
    dirtyRef,
  } = state;
  const { refresh } = query;
  async function publish() {
    if (mutationRef.current) return;
    mutationRef.current = true;
    setAction("publish");
    setError(null);
    try {
      if (!(await onBeforePublish())) return;
      await publicationApi.publishWorkflow(workflowId, description, maxConcurrency);
      dirtyRef.current = false;
      setFormDirty(false);
      await refresh();
    } catch (reason) {
      setError(mutationError(reason, "发布失败"));
    } finally {
      mutationRef.current = false;
      setAction(null);
    }
  }

  async function createKey() {
    if (mutationRef.current || !keyName.trim()) return;
    mutationRef.current = true;
    setAction("key");
    setError(null);
    try {
      const created = await publicationApi.createApiKey(workflowId, keyName.trim());
      setNewSecret(created.key);
      setKeyName("Production");
      await refresh();
    } catch (reason) {
      setError(mutationError(reason, "创建 API Key 失败"));
    } finally {
      mutationRef.current = false;
      setAction(null);
    }
  }

  async function revoke(keyId: string) {
    if (mutationRef.current || !window.confirm("确认吊销这个 API Key？吊销后无法恢复。")) return;
    mutationRef.current = true;
    setAction("key");
    try {
      await publicationApi.revokeApiKey(workflowId, keyId);
      await refresh();
    } catch (reason) {
      setError(mutationError(reason, "吊销失败"));
    } finally {
      mutationRef.current = false;
      setAction(null);
    }
  }

  async function disable() {
    if (mutationRef.current || !window.confirm("停用后，外部系统将不能创建新任务。确认停用？"))
      return;
    mutationRef.current = true;
    setAction("disable");
    try {
      await publicationApi.disableWorkflow(workflowId);
      await refresh();
    } catch (reason) {
      setError(mutationError(reason, "停用失败"));
    } finally {
      mutationRef.current = false;
      setAction(null);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("复制失败，请选中文本手动复制。");
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open && mutationRef.current) return;
    if (!open && dirtyRef.current && !window.confirm("放弃尚未发布的参数修改？不会自动发布。"))
      return;
    if (!open) {
      // The full key is deliberately one-time material. Do not keep it in component state after
      // the panel is closed, otherwise reopening the panel would reveal it again.
      setNewSecret(null);
      setInspectedRun(null);
      setCopied(false);
    }
    onOpenChange(open);
  }

  function closeKeyDialog(open: boolean) {
    if (!open && mutationRef.current) return;
    if (
      !open &&
      !newSecret &&
      keyName !== "Production" &&
      !window.confirm("放弃未签发的凭证名称？")
    )
      return;
    if (!open) {
      setNewSecret(null);
      setCopied(false);
      setKeyName("Production");
    }
    setKeyDialog(open);
  }

  return { publish, createKey, revoke, disable, copy, handleOpenChange, closeKeyDialog };
}
