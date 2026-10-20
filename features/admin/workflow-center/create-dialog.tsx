"use client";

import { useRef, useState } from "react";
import { Boxes, Film, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { editorApi } from "../workflow-api";
import { createStarterWorkflow } from "@/features/workflow/template";
import { createV2Workflow } from "@/features/workflow/v2/types";
import { isTypedWorkflowGraph, type WorkflowGraph } from "@/features/workflow/types";
import type { WorkflowDocument } from "@/features/workflow/api";

export interface InitialWorkflow {
  name: string;
  graph: WorkflowGraph;
  copyOrigin?: WorkflowDocument["copyOrigin"];
}

/** 创建只调用稳定草稿接口；类型先选定，不创建运行或隐式发布。 */
export function CreateWorkflowDialog({
  enabled,
  onClose,
  onCreated,
  initial,
}: {
  enabled: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  initial?: InitialWorkflow;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState(
    initial && isTypedWorkflowGraph(initial.graph) ? "general" : "media",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  function close() {
    if (!busy && (!name.trim() || window.confirm("尚未创建工作流，放弃已填写的内容？"))) onClose();
  }
  async function create() {
    if (lock.current) return;
    if (!name.trim()) {
      setError("请输入工作流名称。");
      return;
    }
    if (kind === "general" && !enabled) {
      setError("本环境尚未启用通用编排。");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const value = await editorApi.createWorkflow(
        name.trim(),
        initial?.graph ?? (kind === "general" ? createV2Workflow() : createStarterWorkflow()),
        initial?.copyOrigin,
      );
      onCreated(value.id);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "创建未完成，请返回列表查询后再决定是否重试。",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) close();
      }}
      isDismissable={!busy}
      showCloseButton={!busy}
      className="sm:max-w-lg"
    >
      <DialogHeader>
        <DialogTitle>
          {initial?.copyOrigin ? "复制为新工作流" : initial ? "导入为新工作流" : "新建工作流"}
        </DialogTitle>
        <DialogDescription>创建后进入对应编辑器，不会运行模型或发布。</DialogDescription>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <label className="block space-y-1.5 text-sm">
          <span>
            工作流名称 <span className="text-destructive">*</span>
          </span>
          <input
            autoFocus
            aria-label="工作流名称"
            maxLength={200}
            className="sol-admin-control w-full"
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <fieldset disabled={busy || !!initial}>
          <legend className="mb-2 text-sm">编排类型</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { value: "media", label: "媒体创作", Icon: Film, help: "图片、视频、参考图与首尾帧" },
              {
                value: "general",
                label: "通用编排",
                Icon: Boxes,
                help: "知识检索、问答、分支与外部操作",
              },
            ].map(({ value, label, Icon, help }) => (
              <label
                key={value}
                className={`flex cursor-pointer gap-2 rounded-lg border p-3 ${kind === value ? "border-primary bg-accent/30" : ""}`}
              >
                <input
                  type="radio"
                  name="workflow-kind"
                  value={value}
                  checked={kind === value}
                  disabled={value === "general" && !enabled}
                  onChange={() => setKind(value)}
                />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Icon size={16} />
                    {label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {value === "general" && !enabled ? "本环境未启用通用编排" : help}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {initial && (
          <p className="text-sm leading-5 text-muted-foreground">
            {initial.copyOrigin
              ? "创建新 ID 并保留来源关系，原工作流不变。"
              : "文件结构与端口已校验。"}
            固定参考素材需要重新选择；知识库、模型和外部操作仍须通过原资源授权，不会因复制或导入自动获得执行权限。
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <footer className="flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" isDisabled={busy} onPress={close}>
            取消
          </Button>
          <Button type="submit" isDisabled={busy || !name.trim()}>
            {busy && <Loader2 className="size-4 animate-spin" />}创建并编辑
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}
