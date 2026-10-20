"use client";
import { listUsers, type ManagedUser } from "@/features/admin/api";
import type { CredentialGrant, CredentialGrants } from "@/features/http-requests/credentials-api";
import { credentialApi } from "@/features/http-requests/credentials-api";
import { useEffect, useRef, useState } from "react";

export function useCredentialAccess({ id }: { id: string }) {
  const [data, setData] = useState<CredentialGrants | null>(null);
  const [kind, setKind] = useState<"account" | "apiKey">("account");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<Pick<
    CredentialGrant,
    "kind" | "id" | "enabled" | "name"
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const lockRef = useRef(false);
  useEffect(() => {
    let disposed = false;
    void credentialApi
      .grants(id)
      .then((value) => {
        if (!disposed) {
          setData(value);
          setError(null);
        }
      })
      .catch(() => {
        if (!disposed) {
          setData(null);
          setError("授权列表读取失败，请刷新。");
        }
      });
    return () => {
      disposed = true;
    };
  }, [id, refresh]);
  useEffect(() => {
    let disposed = false;
    const timer = setTimeout(() => {
      void listUsers(search, 0, 100)
        .then((value) => {
          if (!disposed) setUsers(value.users);
        })
        .catch(() => {
          if (!disposed) setUsers([]);
        });
    }, 250);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [search]);
  async function confirm() {
    if (!pending || !reason.trim() || lockRef.current) return;
    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await credentialApi.grant(id, pending.kind, pending.id, pending.enabled, reason.trim());
      setPending(null);
      setReason("");
      setSubject("");
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "调整未完成");
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  }

  return {
    id,
    data,
    setData,
    kind,
    setKind,
    users,
    setUsers,
    search,
    setSearch,
    subject,
    setSubject,
    reason,
    setReason,
    pending,
    setPending,
    busy,
    setBusy,
    error,
    setError,
    refresh,
    setRefresh,
    lockRef,
    confirm,
  };
}
export type CredentialAccessController = ReturnType<typeof useCredentialAccess>;
