"use client";
import * as publicationApi from "@/features/workflow/external-api/api";
import { useCallback, useEffect } from "react";
import { isAccessDenied } from "../publication-errors";
import type { PublicationProps } from "../publication-types";
import type { PublicationState } from "./use-publication-state";
export function usePublicationQuery(props: PublicationProps, state: PublicationState) {
  const { workflowId, isOpen } = props;
  const {
    setDeployments,
    setApiKeys,
    setRuns,
    setDescription,
    setMaxConcurrency,
    setNewSecret,
    setLoading,
    setError,
    setCopied,
    mutationRef,
    setInspectedRun,
    setFormDirty,
    accessDenied,
    setAccessDenied,
    setKeyDialog,
    dirtyRef,
    readEpochRef,
  } = state;
  const clearRestrictedState = useCallback(() => {
    readEpochRef.current += 1;
    setAccessDenied(true);
    setNewSecret(null);
    setKeyDialog(false);
    setInspectedRun(null);
    setDeployments([]);
    setApiKeys([]);
    setRuns([]);
    setDescription("");
    setCopied(false);
    dirtyRef.current = false;
    setFormDirty(false);
  }, [
    dirtyRef,
    readEpochRef,
    setAccessDenied,
    setApiKeys,
    setCopied,
    setDeployments,
    setDescription,
    setFormDirty,
    setInspectedRun,
    setKeyDialog,
    setNewSecret,
    setRuns,
  ]);

  const refresh = useCallback(async () => {
    const epoch = ++readEpochRef.current;
    setLoading(true);
    setError(null);
    try {
      const [deploymentResult, keyResult, runResult] = await Promise.all([
        publicationApi.listDeployments(workflowId),
        publicationApi.listApiKeys(workflowId),
        publicationApi.listExternalRuns(workflowId),
      ]);
      if (epoch !== readEpochRef.current) return;
      setDeployments(deploymentResult.deployments);
      setApiKeys(keyResult.apiKeys);
      setRuns(runResult.runs);
      setAccessDenied(false);
      const current = deploymentResult.deployments.find((item) => item.status === "published");
      if (current && !dirtyRef.current) {
        setDescription(current.description);
        setMaxConcurrency(current.maxConcurrency);
      }
    } catch (reason) {
      if (epoch !== readEpochRef.current) return;
      if (isAccessDenied(reason)) clearRestrictedState();
      setError(reason instanceof Error ? reason.message : "加载发布信息失败");
    } finally {
      setLoading(false);
    }
  }, [
    readEpochRef,
    setLoading,
    setError,
    workflowId,
    setDeployments,
    setApiKeys,
    setRuns,
    setAccessDenied,
    dirtyRef,
    setDescription,
    setMaxConcurrency,
    clearRestrictedState,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function loadInitialState() {
      const epoch = ++readEpochRef.current;
      try {
        const [deploymentResult, keyResult, runResult] = await Promise.all([
          publicationApi.listDeployments(workflowId),
          publicationApi.listApiKeys(workflowId),
          publicationApi.listExternalRuns(workflowId),
        ]);
        if (cancelled || epoch !== readEpochRef.current) return;
        setDeployments(deploymentResult.deployments);
        setApiKeys(keyResult.apiKeys);
        setRuns(runResult.runs);
        const published = deploymentResult.deployments.find((item) => item.status === "published");
        if (published) {
          setDescription(published.description);
          setMaxConcurrency(published.maxConcurrency);
        }
      } catch (reason) {
        if (!cancelled && epoch === readEpochRef.current) {
          if (isAccessDenied(reason)) clearRestrictedState();
          setError(reason instanceof Error ? reason.message : "加载发布信息失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInitialState();
    return () => {
      cancelled = true;
      readEpochRef.current += 1;
    };
  }, [
    isOpen,
    workflowId,
    clearRestrictedState,
    readEpochRef,
    setDeployments,
    setApiKeys,
    setRuns,
    setDescription,
    setMaxConcurrency,
    setError,
    setLoading,
  ]);

  // 只读复核已打开的页面；撤权后立即清空正文和一次性凭证，不重发任何写操作。
  useEffect(() => {
    if (!isOpen || accessDenied) return;
    let cancelled = false,
      checking = false;
    async function checkAccess() {
      if (checking || mutationRef.current || document.visibilityState === "hidden") return;
      checking = true;
      try {
        await Promise.all([
          publicationApi.listDeployments(workflowId),
          publicationApi.listApiKeys(workflowId),
        ]);
      } catch (reason) {
        if (!cancelled && isAccessDenied(reason)) {
          clearRestrictedState();
          setError("访问权限已失效，发布内容和完整凭证已清除。");
        }
      } finally {
        checking = false;
      }
    }
    const timer = window.setInterval(() => void checkAccess(), 10_000);
    document.addEventListener("visibilitychange", checkAccess);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", checkAccess);
    };
  }, [isOpen, workflowId, accessDenied, clearRestrictedState, mutationRef, setError]);

  return { refresh };
}
export type PublicationQuery = ReturnType<typeof usePublicationQuery>;
