"use client";
import { empty } from "@/features/http-requests/credential-form";
import {
  credentialApi,
  type HttpCredentialDetail,
  type HttpCredentialForm,
  type HttpCredentialSummary,
} from "@/features/http-requests/credentials-api";
import { useEffect, useRef, useState } from "react";

export function useCredentialManager({
  onClose,
  onSaved,
  initialId = "",
  initialScope,
}: {
  onClose: () => void;
  onSaved?: (id: string, revision: string) => void;
  initialId?: string;
  initialScope?: { method: string; url: string };
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lockRef = useRef(false);
  const [list, setList] = useState<HttpCredentialSummary[]>([]);
  const [id, setId] = useState(initialId);
  const [detail, setDetail] = useState<HttpCredentialDetail | null>(null);
  const [form, setForm] = useState<HttpCredentialForm>(() => {
    const value = empty();
    if (initialScope) {
      try {
        const url = new URL(initialScope.url);
        value.origin = url.origin;
        value.requests = [{ method: initialScope.method, url: url.origin + url.pathname }];
      } catch {
        /* 未填写完整地址时交由表单补齐。 */
      }
    }
    return value;
  });
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(!!initialId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const element = dialogRef.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    let disposed = false;
    void credentialApi
      .list()
      .then((value) => {
        if (!disposed) setList(value);
      })
      .catch((cause) => {
        if (!disposed) setError(cause instanceof Error ? cause.message : "凭据列表读取失败。");
      });
    return () => {
      disposed = true;
    };
  }, [refresh]);
  useEffect(() => {
    let disposed = false;
    if (!id) return;
    void credentialApi
      .detail(id)
      .then((value) => {
        if (disposed) return;
        const revision = value.revisions.find((item) => item.id === value.currentRevision);
        setDetail(value);
        setForm({
          name: value.name,
          description: value.description,
          origin: revision?.definition.origin ?? "",
          headers:
            revision?.definition.headers.map((name) => ({ name, value: "" })) ?? empty().headers,
          requests: revision?.definition.requests ?? [],
        });
        setLoading(false);
      })
      .catch((cause) => {
        if (!disposed) {
          setLoading(false);
          setError(cause instanceof Error ? cause.message : "凭据读取失败。");
        }
      });
    return () => {
      disposed = true;
    };
  }, [id, refresh]);
  async function save() {
    if (lockRef.current) return;
    lockRef.current = true;
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const saved = await credentialApi.save(id || null, form);
      setForm((value) => ({
        ...value,
        headers: value.headers.map((row) => ({ ...row, value: "" })),
      }));
      setId(saved.id);
      setRefresh((value) => value + 1);
      setMessage(
        onSaved
          ? "凭据版本已保存。普通账号和 API Key 需在下方分别授权。"
          : "凭据版本已保存。已发布工作流仍使用原版本。",
      );
      onSaved?.(saved.id, saved.revisionId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败，请重试。");
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  }
  async function toggle() {
    if (!detail || lockRef.current) return;
    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await credentialApi.state(detail.id, !detail.enabled);
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "状态更新失败。");
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  }

  return {
    onClose,
    onSaved,
    initialId,
    initialScope,
    dialogRef,
    lockRef,
    list,
    setList,
    id,
    setId,
    detail,
    setDetail,
    form,
    setForm,
    refresh,
    setRefresh,
    loading,
    setLoading,
    busy,
    setBusy,
    error,
    setError,
    message,
    setMessage,
    save,
    toggle,
  };
}
export type CredentialManagerController = ReturnType<typeof useCredentialManager>;
