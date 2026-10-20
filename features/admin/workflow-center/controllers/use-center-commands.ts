"use client";
import { getWorkflowTemplate } from "@/features/admin/api";
import { copyTemplateGraphForApi, editorApi } from "@/features/admin/workflow-api";
import { type CenterItem } from "@/features/admin/workflow-center/api";
import { type InitialWorkflow } from "@/features/admin/workflow-center/create-dialog";
import { importCenterWorkflow } from "@/features/admin/workflow-center/import-file";
import { exportWorkflow, MAX_WORKFLOW_FILE_BYTES } from "@/features/workflow/persistence";
import { isTypedWorkflowGraph } from "@/features/workflow/types";
import { snapshotGraph, type WorkflowV2Graph } from "@/features/workflow/v2/types";
import { downloadJson } from "@/lib/download";
import { useRef, useState } from "react";

export function useCenterCommands() {
  const [actionError, setActionError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [initial, setInitial] = useState<InitialWorkflow | undefined>();
  const [deleting, setDeleting] = useState<CenterItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const actionLockRef = useRef(false);
  async function withDocument(item: CenterItem, mode: "copy" | "export") {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setBusyId(item.source + item.id);
    setActionError(null);
    try {
      const document =
        item.source === "template"
          ? await getWorkflowTemplate(item.id)
          : await editorApi.getWorkflow(item.id);
      if (!document.graph) throw new Error("工作流没有可读取的图。");
      const graph = isTypedWorkflowGraph(document.graph)
        ? snapshotGraph(document.graph as WorkflowV2Graph)
        : copyTemplateGraphForApi(document.graph);
      if (mode === "copy") {
        setInitial({
          name: (item.name + " 副本").slice(0, 200),
          graph,
          copyOrigin: { source: item.source, id: item.id },
        });
        setCreating(true);
      } else
        downloadJson(
          `creativeflow-workflow-${item.id.slice(0, 8)}.json`,
          isTypedWorkflowGraph(document.graph)
            ? JSON.stringify(
                {
                  format: "creativeflow-workflow",
                  formatVersion: 1,
                  schemaVersion: 1,
                  name: document.name,
                  graph,
                },
                null,
                2,
              )
            : exportWorkflow(document.name, document.graph),
        );
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "操作未完成。");
    } finally {
      actionLockRef.current = false;
      setBusyId(null);
    }
  }
  async function importFile(file: File) {
    setActionError(null);
    if (file.size > MAX_WORKFLOW_FILE_BYTES) {
      setActionError("工作流文件不能超过 2 MB。");
      return;
    }
    try {
      const value = importCenterWorkflow(await file.text());
      if (!value.ok) throw new Error("导入校验失败：" + value.detail);
      setInitial({ name: value.name, graph: copyTemplateGraphForApi(value.graph) });
      setCreating(true);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "无法读取工作流文件。");
    }
  }
  async function copyId(item: CenterItem) {
    try {
      await navigator.clipboard.writeText(item.id);
      setCopied(item.source + item.id);
    } catch {
      setActionError("复制失败，可在工作流详情中选择完整 ID。");
    }
  }

  return {
    actionError,
    setActionError,
    creating,
    setCreating,
    initial,
    setInitial,
    deleting,
    setDeleting,
    notice,
    setNotice,
    busyId,
    setBusyId,
    copied,
    setCopied,
    fileInput,
    actionLockRef,
    withDocument,
    importFile,
    copyId,
  };
}
