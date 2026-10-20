"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const changed = "creativeflow:admin-query";

/** 查询状态仅包含公开筛选条件，支持刷新及浏览器前进/后退，不保存执行参数。 */
export function useAdminQuery() {
  const subscribe = useCallback((listener: () => void) => {
    window.addEventListener("popstate", listener);
    window.addEventListener(changed, listener);
    return () => {
      window.removeEventListener("popstate", listener);
      window.removeEventListener(changed, listener);
    };
  }, []);
  const value = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  const query = useMemo(() => new URLSearchParams(value), [value]);
  const update = useCallback((values: Record<string, string | null>, push = false) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const url = window.location.pathname + (next.size ? `?${next}` : "");
    if (push) window.history.pushState(window.history.state, "", url);
    else window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new Event(changed));
  }, []);
  return [query, update] as const;
}

/** 返回地址只接受管理列表，防止 URL 参数变成任意跳转或携带敏感运行输入。 */
export function workflowReturnUrl(value: string | null | undefined): string {
  if (!value) return "/admin/workflows";
  try {
    const url = new URL(value, "http://admin.invalid");
    if (
      url.origin !== "http://admin.invalid" ||
      !["/admin", "/admin/workflows"].includes(url.pathname)
    )
      return "/admin/workflows";
    const safe = new URLSearchParams();
    for (const [key, item] of url.searchParams)
      if (
        [
          "tab",
          "q",
          "kind",
          "source",
          "view",
          "id",
          "api",
          "template",
          "from",
          "to",
          "sort",
          "page",
          "size",
        ].includes(key)
      )
        safe.set(key, item);
    return url.pathname + (safe.size ? `?${safe}` : "");
  } catch {
    return "/admin/workflows";
  }
}
