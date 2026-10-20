"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  deleteManagedWorkflow,
  previewWorkflowDeletion,
  type DeletionTarget,
  type WorkflowDeletionPreview,
} from "./api";

/** 两种编辑器与列表共用同一确认流程；错误后只允许重新查询，不自动重试删除。 */
export function DeleteWorkflowDialog({
  target,
  onClose,
  onDeleted,
  onNavigate,
  hasUnsavedChanges = false,
}: {
  target: DeletionTarget;
  onClose: () => void;
  onDeleted: () => void;
  onNavigate: (section: "publications" | "runs") => void;
  hasUnsavedChanges?: boolean;
}) {
  const [preview, setPreview] = useState<WorkflowDeletionPreview | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const lock = useRef(false);
  const { id, source } = target;
  const deleted = useRef(onDeleted);
  useEffect(() => {
    deleted.current = onDeleted;
  }, [onDeleted]);
  useEffect(() => {
    const abort = new AbortController();
    let disposed = false;
    void previewWorkflowDeletion({ id, source }, abort.signal)
      .then((value) => {
        if (disposed) return;
        if (value.deletedAt) {
          deleted.current();
          return;
        }
        setPreview(value);
      })
      .catch((reason) => {
        if (!disposed) setError(reason instanceof Error ? reason.message : "删除影响查询失败。");
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
      abort.abort();
    };
  }, [id, source, reload]);

  async function remove() {
    if (lock.current || !preview?.canDelete || name !== preview.name) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await deleteManagedWorkflow(target, name, preview.revision);
      deleted.current();
    } catch (reason) {
      setPreview(null);
      setName("");
      setError(
        `${reason instanceof Error ? reason.message : "删除结果不明确。"} 请重新查询确认当前状态，不会自动重试删除。`,
      );
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      isOpen
      aria-label="删除工作流"
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      isDismissable={!busy}
      showCloseButton={!busy}
      className="sm:max-w-xl"
    >
      <DialogHeader>
        <DialogTitle>
          <span className="flex items-center gap-2">
            <Trash2 className="size-5 text-destructive" />
            删除工作流
          </span>
        </DialogTitle>
        <DialogDescription>
          确认删除「{preview?.name ?? target.name}
          」。删除后不能再编辑、发布或执行；此处不提供恢复操作。
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 text-sm">
        {loading && <p role="status">正在检查发布状态、排队任务和运行记录…</p>}
        {error && (
          <div role="alert" className="space-y-2 rounded-lg bg-destructive/5 p-3 text-destructive">
            <p>{error}</p>
            <Button
              variant="outline"
              size="sm"
              isDisabled={loading || busy}
              onPress={() => {
                setError(null);
                setPreview(null);
                setName("");
                setLoading(true);
                setReload((value) => value + 1);
              }}
            >
              重新查询
            </Button>
          </div>
        )}
        {preview && (
          <>
            {!preview.canDelete && (
              <div
                role="alert"
                className="space-y-2 rounded-lg border border-warning/30 bg-warning/5 p-3"
              >
                <p className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="size-4" />
                  暂时不能删除
                </p>
                {(preview.publishedApis > 0 || preview.publishedTemplates > 0) && (
                  <div>
                    <p>
                      仍有 {preview.publishedApis} 个已开放 API、{preview.publishedTemplates}{" "}
                      个已上架模板。请先停用或下架。
                    </p>
                    <Button variant="link" size="sm" onPress={() => onNavigate("publications")}>
                      前往发布与版本
                    </Button>
                  </div>
                )}
                {(preview.queuedRuns > 0 || preview.runningRuns > 0) && (
                  <div>
                    <p>
                      仍有 {preview.queuedRuns} 个排队任务、{preview.runningRuns}{" "}
                      个运行任务。请等待完成或取消后再删除。
                    </p>
                    <Button variant="link" size="sm" onPress={() => onNavigate("runs")}>
                      查看运行记录
                    </Button>
                  </div>
                )}
                <p className="text-muted-foreground">不会自动停用接口或取消任务。</p>
              </div>
            )}
            <div className="rounded-lg border p-3">
              <h3 className="mb-2 font-medium">删除影响</h3>
              <dl className="grid grid-cols-2 gap-2">
                <dt>保留运行记录</dt>
                <dd>{preview.historyRuns} 条</dd>
                <dt>保留发布快照</dt>
                <dd>{preview.deploymentVersions} 个</dd>
                <dt>保留 API Key 记录</dt>
                <dd>{preview.apiKeys} 个（不能再调用此工作流）</dd>
                <dt>不受影响的已记录副本</dt>
                <dd>{preview.independentCopies} 个</dd>
              </dl>
              <p className="mt-3 text-muted-foreground">
                生成的图片、视频、素材库资源及历史审计记录均保留，不删除共享凭据或知识库。可从工作流中心“已删除”筛选查看只读运行历史。
              </p>
            </div>
            {hasUnsavedChanges && (
              <p className="rounded-lg bg-muted p-3">
                当前编辑器有未保存修改，确认删除将一并放弃这些修改。
              </p>
            )}
            {preview.canDelete && (
              <label className="grid gap-2">
                输入完整工作流名称确认：<strong className="break-all">{preview.name}</strong>
                <input
                  autoComplete="off"
                  className="sol-admin-control w-full"
                  aria-label="确认工作流名称"
                  value={name}
                  maxLength={200}
                  disabled={busy}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            )}
          </>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" isDisabled={busy} onPress={onClose}>
          取消
        </Button>
        <Button
          variant="destructive"
          isDisabled={loading || busy || !preview?.canDelete || name !== preview.name}
          onPress={() => void remove()}
        >
          {busy ? "删除中…" : "确认删除"}
        </Button>
      </div>
    </Dialog>
  );
}
