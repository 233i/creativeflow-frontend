"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as api from "@/features/auth/api";

interface AuthContextValue {
  account: api.AuthAccount | null;
  providers: api.AuthProvider[];
  loading: boolean;
  error: string | null;
  isGuest: boolean;
  refresh: () => Promise<void>;
  login: (provider: string) => void;
  link: (provider: string) => void;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  registerWithPassword: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<api.AuthAccount | null>(null);
  const [providers, setProviders] = useState<api.AuthProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [available, me] = await Promise.all([api.listProviders(), api.getMe()]);
      setProviders(available.providers);
      setAccount(me.account);
      setError(null);
    } catch (reason) {
      // 任何状态失败时都保持账户缺失。AuthGate 将其视为关闭边界，
      // 因此临时故障绝不会意外挂载匿名用户画布。
      setAccount(null);
      setProviders([]);
      setError(reason instanceof Error ? reason.message : "unknown");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const authError = query.get("auth_error");
    if (authError) {
      window.setTimeout(() => setError(authError), 0);
      query.delete("auth_error");
      const queryString = query.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${queryString ? `?${queryString}` : ""}`,
      );
    }

    const refreshTimer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(refreshTimer);
  }, [refresh]);

  const start = useCallback((provider: string, mode: "login" | "link") => {
    const returnUrl = `${window.location.pathname}${window.location.search}`;
    window.location.assign(
      `/api/v1/auth/${mode}/${encodeURIComponent(provider)}?returnUrl=${encodeURIComponent(returnUrl)}`,
    );
  }, []);

  const login = useCallback((provider: string) => start(provider, "login"), [start]);
  const link = useCallback((provider: string) => start(provider, "link"), [start]);

  const completePasswordAuth = useCallback(async (pending: Promise<api.AuthMe>) => {
    try {
      const me = await pending;
      setAccount(me.account);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "unknown");
      throw reason;
    }
  }, []);

  const loginWithPassword = useCallback(
    (email: string, password: string) =>
      completePasswordAuth(api.loginWithPassword(email, password)),
    [completePasswordAuth],
  );

  const registerWithPassword = useCallback(
    (email: string, password: string, displayName?: string) =>
      completePasswordAuth(api.registerWithPassword(email, password, displayName)),
    [completePasswordAuth],
  );

  const logout = useCallback(async () => {
    await api.logout();
    // 服务器也会删除设备 Cookie。移除镜像可确保后续登录建立全新且显式关联的设备身份。
    window.localStorage.removeItem("sol.device_id");
    window.location.reload();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      account,
      providers,
      loading,
      error,
      isGuest: account === null,
      refresh,
      login,
      link,
      loginWithPassword,
      registerWithPassword,
      logout,
    }),
    [
      account,
      providers,
      loading,
      error,
      refresh,
      login,
      link,
      loginWithPassword,
      registerWithPassword,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
