"use client";
import { useAdminQuery, workflowReturnUrl } from "@/features/admin/admin-query";
import { editorApi } from "@/features/admin/workflow-api";
import {
  listWorkflowCenter,
  readCenterQuery,
  type CenterItem,
  type CenterPage,
} from "@/features/admin/workflow-center/api";
import { WorkflowApiError } from "@/features/workflow/api";
import { useWorkspaceRouter as useRouter } from "@/components/providers/workspace-context";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceActive, useWorkspacePage } from "@/components/providers/workspace-context";

export function useCenterQuery(defaultView: string) {
  const workspace = useWorkspacePage();
  const active = useWorkspaceActive();
  const router = useRouter();
  const [params, update] = useAdminQuery();
  const query = useMemo(() => readCenterQuery(params, defaultView), [params, defaultView]);
  const queryKey = JSON.stringify(query);
  const [data, setData] = useState<{ key: string; page: CenterPage } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [capability, setCapability] = useState<{ enabled: boolean; create: boolean } | null>(null);
  const [selected, setSelected] = useState<CenterItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const page = data?.key === queryKey ? data.page : null;
  const currentPage = Math.floor(query.offset / query.limit) + 1;
  const returnUrl = workflowReturnUrl(
    workspace?.href ??
      (typeof window === "undefined" ? null : window.location.pathname + window.location.search),
  );
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    void editorApi
      .getWorkflowCapabilities()
      .then((value) => {
        if (!disposed) setCapability({ enabled: value.enabled, create: true });
      })
      .catch(() => {
        if (!disposed) setCapability({ enabled: false, create: false });
      });
    return () => {
      disposed = true;
    };
  }, [refresh, active]);

  useEffect(() => {
    if (!active) return;
    const abort = new AbortController();
    let disposed = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void listWorkflowCenter(JSON.parse(queryKey), abort.signal)
        .then((value) => {
          if (!disposed) setData({ key: queryKey, page: value });
        })
        .catch((reason) => {
          if (disposed) return;
          if (reason instanceof WorkflowApiError && [401, 403].includes(reason.status)) {
            setData(null);
            setSelected(null);
          }
          setError(reason instanceof Error ? reason.message : "工作流中心读取失败。");
        })
        .finally(() => {
          if (!disposed) setLoading(false);
        });
    }, 180);
    return () => {
      disposed = true;
      abort.abort();
      window.clearTimeout(timer);
    };
  }, [queryKey, refresh, active]);

  useEffect(() => {
    if (!page || !scrollRef.current) return;
    try {
      scrollRef.current.scrollTop =
        Number(sessionStorage.getItem("creativeflow.admin.workflowScroll:" + queryKey)) || 0;
    } catch {
      /* 恢复滚动失败不影响读取。 */
    }
  }, [page, queryKey]);

  function href(item: CenterItem, section = "edit") {
    if (item.deletedAt) section = "runs";
    return `/admin/workflows/${encodeURIComponent(item.id)}/${section}?${new URLSearchParams({ source: item.source, returnTo: returnUrl })}`;
  }
  function resetFilters() {
    update(
      Object.fromEntries(
        ["q", "kind", "source", "view", "id", "api", "template", "from", "to", "page"].map(
          (key) => [key, null],
        ),
      ),
    );
  }

  return {
    router,
    params,
    update,
    query,
    queryKey,
    data,
    setData,
    loading,
    setLoading,
    error,
    setError,
    refresh,
    setRefresh,
    capability,
    setCapability,
    selected,
    setSelected,
    scrollRef,
    page,
    currentPage,
    returnUrl,
    href,
    resetFilters,
  };
}
