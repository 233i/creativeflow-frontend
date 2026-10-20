"use client";

import { useCallback, useSyncExternalStore } from "react";

const eventName = "creativeflow:admin-preference";
const prefix = "creativeflow.admin.";
const session = new Map<string, string>();

/** 管理页只保存布局偏好；运行正文、参数与凭据不进入本地偏好。 */
export function useAdminPreference(
  key: "sidebar" | "density" | "drawerWidth" | "workflowColumns" | "workflowWidths" | "assetView",
  fallback: string,
) {
  const subscribe = useCallback((listener: () => void) => {
    window.addEventListener("storage", listener);
    window.addEventListener(eventName, listener);
    return () => {
      window.removeEventListener("storage", listener);
      window.removeEventListener(eventName, listener);
    };
  }, []);
  const snapshot = useCallback(() => {
    if (session.has(key)) return session.get(key)!;
    try {
      return window.localStorage.getItem(prefix + key) ?? fallback;
    } catch {
      return fallback;
    }
  }, [key, fallback]);
  const value = useSyncExternalStore(subscribe, snapshot, () => fallback);
  const set = useCallback(
    (next: string) => {
      try {
        window.localStorage.setItem(prefix + key, next);
        session.delete(key);
      } catch {
        session.set(key, next);
      }
      window.dispatchEvent(new Event(eventName));
    },
    [key],
  );
  return [value, set] as const;
}
