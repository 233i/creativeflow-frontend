"use client";
import * as adminApi from "@/features/admin/api";
import { editorApi } from "@/features/admin/workflow-api";
import { listWorkflowCenter } from "@/features/admin/workflow-center/api";
import { useEffect } from "react";
import type { DetailState } from "./use-detail-state";
export function useDetailQuery(state: DetailState) {
  const {
    id,
    source,
    identity,
    setIdentity,
    setChecking,
    setDocument,
    setItem,
    setSession,
    setError,
    retry,
  } = state;
  useEffect(() => {
    let disposed = false;
    async function check() {
      try {
        const value = await adminApi.getMe();
        if (!disposed) {
          setIdentity(value.admin);
          if (!value.admin) {
            setDocument(null);
            setSession(null);
            setItem(null);
          }
        }
      } catch {
        if (!disposed) {
          setIdentity(null);
          setDocument(null);
          setSession(null);
          setItem(null);
        }
      } finally {
        if (!disposed) setChecking(false);
      }
    }
    void check();
    const visible = () => {
      if (window.document.visibilityState === "visible") void check();
    };
    window.document.addEventListener("visibilitychange", visible);
    return () => {
      disposed = true;
      window.document.removeEventListener("visibilitychange", visible);
    };
  }, [setChecking, setDocument, setIdentity, setItem, setSession]);
  useEffect(() => {
    if (!identity) return;
    let disposed = false;
    void listWorkflowCenter({
      id,
      source,
      includeDeleted: true,
      sort: "updated_desc",
      offset: 0,
      limit: 20,
    })
      .then(async (list) => {
        if (disposed) return;
        const resource = list.items[0];
        if (!resource) throw new Error("此工作流不在当前管理范围内。");
        if (resource.deletedAt) {
          setItem(resource);
          setDocument(null);
          setSession(null);
          setError(null);
          return;
        }
        const value =
          source === "template"
            ? await adminApi.getWorkflowTemplate(id)
            : await editorApi.getWorkflow(id);
        if (!disposed) {
          setDocument(value);
          setItem(resource);
          setError(null);
        }
      })
      .catch((reason) => {
        if (!disposed) {
          setDocument(null);
          setItem(null);
          setSession(null);
          setError(reason instanceof Error ? reason.message : "无法读取工作流。");
        }
      });
    return () => {
      disposed = true;
    };
  }, [identity, id, source, retry, setItem, setDocument, setSession, setError]);
}
