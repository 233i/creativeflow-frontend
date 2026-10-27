"use client";
import { listUsers, type ManagedUser } from "@/features/admin/api";
import { knowledgeAccessApi, type KnowledgeGrants } from "@/features/knowledge/access-api";
import { useEffect, useRef, useState } from "react";
import { useWorkspaceGuard } from "@/components/providers/workspace-context";

export function useKnowledgePermissionsPanel({ libraryId }: { libraryId: string }) {
  const [data, setData] = useState<KnowledgeGrants | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [account, setAccount] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<{ id: string; name: string; enabled: boolean } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [keyMode, setKeyMode] = useState(false);
  const lockRef = useRef(false);
  useWorkspaceGuard({
    dirty: !!account || !!reason || !!pending,
    busy,
    message: "知识库账号授权尚未确认，关闭将放弃输入。",
  });
  const aliveRef = useRef(true);
  const searchSequenceRef = useRef(0);
  useEffect(() => {
    aliveRef.current = true;
    void knowledgeAccessApi
      .grants(libraryId)
      .then((value) => {
        if (aliveRef.current) setData(value);
      })
      .catch(() => {
        if (aliveRef.current) setError("授权列表读取失败，请重新进入此页。");
      });
    return () => {
      aliveRef.current = false;
    };
  }, [libraryId]);
  useEffect(() => {
    const sequenceRef = ++searchSequenceRef.current;
    let disposed = false;
    const timer = setTimeout(() => {
      void listUsers(search, 0, 100)
        .then((value) => {
          if (!disposed && aliveRef.current && sequenceRef === searchSequenceRef.current)
            setUsers(value.users);
        })
        .catch(() => {
          if (!disposed && aliveRef.current && sequenceRef === searchSequenceRef.current)
            setError("账号列表读取失败。");
        });
    }, 250);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [search]);
  async function confirm() {
    if (!pending || lockRef.current || !reason.trim()) return;
    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await knowledgeAccessApi.setGrant(libraryId, pending.id, pending.enabled, reason.trim());
      // 写入确认即关闭确认框；随后读失败不能诱使用户重复提交。
      if (aliveRef.current) {
        setPending(null);
        setReason("");
        setAccount("");
      }
      const next = await knowledgeAccessApi.grants(libraryId);
      if (aliveRef.current) setData(next);
    } catch (cause) {
      if (aliveRef.current) setError(cause instanceof Error ? cause.message : "授权调整失败");
    } finally {
      lockRef.current = false;
      if (aliveRef.current) setBusy(false);
    }
  }
  const selected = users.find((user) => user.id === account);

  return {
    libraryId,
    data,
    setData,
    users,
    setUsers,
    search,
    setSearch,
    account,
    setAccount,
    reason,
    setReason,
    pending,
    setPending,
    error,
    setError,
    busy,
    setBusy,
    keyMode,
    setKeyMode,
    lockRef,
    aliveRef,
    searchSequenceRef,
    confirm,
    selected,
  };
}
export type KnowledgePermissionsPanelController = ReturnType<typeof useKnowledgePermissionsPanel>;
