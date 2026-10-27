"use client";
import * as adminApi from "@/features/admin/api";
import { editorApi } from "@/features/admin/workflow-api";
import { listWorkflowCenter } from "@/features/admin/workflow-center/api";
import { WorkflowApiError } from "@/features/workflow/api";
import { useWorkspaceActive } from "@/components/providers/workspace-context";
import { useEffect, useRef } from "react";
import type { DetailState } from "./use-detail-state";
export function useDetailQuery(state: DetailState) {
  useDetailRevalidation(state);
  const { id, source, identity, setDocument, setItem, setSession, setError, retry } = state;
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

/** 返回缓存页签时只复验资源状态，不用服务端草稿覆盖当前未保存的画布。 */
function useDetailRevalidation(state: DetailState) {
  const active = useWorkspaceActive();
  const previous = useRef(active);
  const { identity, id, source, setItem, setDocument, setSession, setError } = state;
  useEffect(() => {
    const returning = active && !previous.current;
    previous.current = active;
    if (!identity || !returning) return;
    let disposed = false;
    function unavailable(message: string) {
      setDocument(null);
      setSession(null);
      setError(message);
    }
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
        if (!resource) return unavailable("此工作流已不可访问，请返回工作流中心重新查询。");
        setItem(resource);
        if (resource.deletedAt) return unavailable("此工作流已删除，编辑已停止。");
        if (source === "template" && resource.templateStatus === "published") {
          const published = await adminApi.getWorkflowTemplate(id);
          if (disposed) return;
          setDocument(published);
          setSession(null);
        }
        setError(null);
      })
      .catch((reason) => {
        if (disposed) return;
        if (reason instanceof WorkflowApiError && [403, 404].includes(reason.status))
          unavailable("此工作流已不可访问，请返回工作流中心重新查询。");
        else setError(reason instanceof Error ? reason.message : "无法复验工作流状态，请重试。");
      });
    return () => {
      disposed = true;
    };
  }, [active, identity, id, source, setItem, setDocument, setSession, setError]);
}
