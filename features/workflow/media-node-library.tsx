"use client";

import { Type, FileImage, Sparkles, Film, FastForward, ScanLine, ImageIcon } from "lucide-react";
import { useT } from "@/components/providers/i18n-provider";
import { WorkflowNodeLibrary, type LibraryItem } from "./node-library";
import type { WorkflowNodeKind } from "./types";

export const MEDIA_NODE_DRAG_MIME = "application/x-creativeflow-media-node";
export const MEDIA_LIBRARY_KINDS: WorkflowNodeKind[] = [
  "text",
  "image",
  "imageGenerate",
  "videoGenerate",
  "videoExtend",
  "videoFrame",
  "imageOutput",
  "videoOutput",
];
export function MediaNodeLibrary({
  disabled,
  count,
  onAdd,
}: {
  disabled: boolean;
  count: number;
  onAdd: (kind: WorkflowNodeKind) => void;
}) {
  const t = useT();
  const items: LibraryItem<WorkflowNodeKind>[] = [
    { kind: "text", label: t("workflow.nodeText"), icon: Type, group: "输入" },
    { kind: "image", label: t("workflow.nodeImage"), icon: FileImage, group: "输入" },
    {
      kind: "imageGenerate",
      label: t("workflow.nodeImageGenerate"),
      icon: Sparkles,
      group: "生成与处理",
    },
    {
      kind: "videoGenerate",
      label: t("workflow.nodeVideoGenerate"),
      icon: Film,
      group: "生成与处理",
    },
    {
      kind: "videoExtend",
      label: t("workflow.nodeVideoExtend"),
      icon: FastForward,
      group: "生成与处理",
    },
    {
      kind: "videoFrame",
      label: t("workflow.nodeVideoFrame"),
      icon: ScanLine,
      group: "生成与处理",
    },
    { kind: "imageOutput", label: t("workflow.nodeImageOutput"), icon: ImageIcon, group: "输出" },
    { kind: "videoOutput", label: t("workflow.nodeVideoOutput"), icon: Film, group: "输出" },
  ];
  return (
    <WorkflowNodeLibrary
      items={items.map((item) => ({ ...item, disabled: disabled || count >= 40 }))}
      mime={MEDIA_NODE_DRAG_MIME}
      onAdd={onAdd}
    />
  );
}
