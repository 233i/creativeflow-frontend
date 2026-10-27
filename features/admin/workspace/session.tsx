"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import * as api from "../api";
import { useAiStore } from "@/features/ai/store";

interface AdminSession {
  identity: api.AdminIdentity | null;
  checking: boolean;
  setIdentity: Dispatch<SetStateAction<api.AdminIdentity | null>>;
}
export const AdminSessionContext = createContext<AdminSession | null>(null);

/** 共享外壳只验证一次身份；恢复可见时复验，失效后卸载所有工作区。 */
export function useAdminSession() {
  const shared = useContext(AdminSessionContext);
  const [identity, setIdentity] = useState<api.AdminIdentity | null>(null);
  const [checking, setChecking] = useState(!shared);
  const sequence = useRef(0);
  const updateIdentity = useCallback((value: SetStateAction<api.AdminIdentity | null>) => {
    sequence.current += 1;
    setIdentity(value);
  }, []);
  const refreshAdmin = useAiStore((state) => state.refreshAdmin);
  useEffect(() => {
    if (shared) return;
    let disposed = false;
    async function check() {
      const request = ++sequence.current;
      try {
        const value = await api.getMe();
        if (!disposed && request === sequence.current)
          setIdentity((previous) =>
            JSON.stringify(previous) === JSON.stringify(value.admin) ? previous : value.admin,
          );
      } catch (reason) {
        if (
          !disposed &&
          request === sequence.current &&
          reason instanceof api.AdminApiError &&
          [401, 403].includes(reason.status)
        )
          setIdentity(null);
      } finally {
        if (!disposed && request === sequence.current) setChecking(false);
      }
    }
    void check();
    const visible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const revoked = () => {
      updateIdentity(null);
      setChecking(false);
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("creativeflow:admin-session-expired", revoked);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("creativeflow:admin-session-expired", revoked);
    };
  }, [shared, updateIdentity]);
  useEffect(() => {
    if (shared || !identity) return;
    void refreshAdmin().catch(() => {});
  }, [shared, identity, refreshAdmin]);
  return shared ?? { identity, checking, setIdentity: updateIdentity };
}
