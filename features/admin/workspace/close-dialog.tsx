"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { workspaceGuards, type WorkspaceStore } from "./store";

export interface PendingWorkspaceAction {
  keys: string[];
  title: string;
  proceed: () => void;
}

export function WorkspaceCloseDialog({
  pending,
  store,
  onCancel,
}: {
  pending: PendingWorkspaceAction | null;
  store: WorkspaceStore;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guards = workspaceGuards(store, pending?.keys ?? []);
  const dirty = guards.filter((guard) => guard.dirty);
  const canSave = dirty.length > 0 && dirty.every((guard) => guard.save);
  const busy = guards.some((guard) => guard.busy);
  async function save() {
    if (!pending || saving || busy) return;
    setSaving(true);
    setError(null);
    try {
      for (const guard of dirty)
        if (!(await guard.save!())) {
          setError("保存未完成，页面已保留。请检查对应页面的错误提示后重试。");
          return;
        }
      pending.proceed();
      onCancel();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败，页面已保留。");
    } finally {
      setSaving(false);
    }
  }
  function discard() {
    for (const guard of guards) guard.discard?.();
    pending?.proceed();
    onCancel();
  }
  return (
    <Dialog
      isOpen={!!pending}
      onOpenChange={(open) => {
        if (!open && !saving) onCancel();
      }}
      isDismissable={!saving}
      showCloseButton={!saving}
    >
      <DialogHeader>
        <DialogTitle>{pending?.title ?? "关闭页面"}</DialogTitle>
        <DialogDescription>
          {dirty.length
            ? "这些页面包含未保存修改。放弃修改后将无法恢复。"
            : "页面中仍有操作正在执行，关闭不会撤回已提交的请求。"}
          已提交的工作流会继续执行，可在运行中心查看。
        </DialogDescription>
      </DialogHeader>
      <ul className="max-h-36 list-inside list-disc overflow-auto text-sm">
        {store
          .getState()
          .tabs.filter((tab) => pending?.keys.includes(tab.key) && (tab.dirty || tab.busy))
          .map((tab) => (
            <li key={tab.key}>{tab.title}</li>
          ))}
      </ul>
      {guards
        .map((guard) => guard.message)
        .filter(Boolean)
        .map((message, index) => (
          <p key={index} className="text-sm text-muted-foreground">
            {message}
          </p>
        ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2 pt-3">
        <Button variant="outline" isDisabled={saving} onPress={onCancel}>
          取消
        </Button>
        <Button variant="outline" isDisabled={saving} onPress={discard}>
          放弃修改并继续
        </Button>
        {canSave && (
          <Button isDisabled={saving || busy} onPress={() => void save()}>
            {saving ? "保存中…" : "保存并继续"}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
