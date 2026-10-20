"use client";
import { useT } from "@/components/providers/i18n-provider";
import { type AgentImageAttachment } from "@/features/agent/types";
import { uploadAsset } from "@/features/ai/api";
import { useEffect, useRef, useState } from "react";

export const MAX_AGENT_IMAGES = 8;
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
export function useAgentAttachments(canAttachImages: boolean) {
  const t = useT();
  const [attachments, setAttachments] = useState<AgentImageAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<AbortController | null>(null);
  useEffect(() => () => uploadRef.current?.abort(), []);

  async function acceptImages(files: FileList | null) {
    if (!files || !canAttachImages || uploadRef.current) return;
    const available = MAX_AGENT_IMAGES - attachments.length;
    if (available <= 0) {
      setAttachmentError(t("agent.imageLimit"));
      return;
    }

    // 同步占用上传批次，避免 React 提交 busy 状态前的第二次文件输入启动另一批。
    const controller = new AbortController();
    uploadRef.current = controller;
    setAttachmentError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, available)) {
        if (!IMAGE_TYPES.has(file.type.toLowerCase())) {
          setAttachmentError(t("agent.imageTypeError"));
          continue;
        }
        const asset = await uploadAsset(file, controller.signal);
        if (controller.signal.aborted) return;
        setAttachments((current) => [
          ...current,
          { id: asset.assetId, url: asset.url, mediaType: asset.mediaType, name: file.name },
        ]);
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setAttachmentError(error instanceof Error ? error.message : t("errors.unknown"));
    } finally {
      uploadRef.current = null;
      if (!controller.signal.aborted) setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((image) => image.id !== id));
    setAttachmentError(null);
  }

  return {
    attachments,
    setAttachments,
    uploading,
    attachmentError,
    setAttachmentError,
    imageInputRef,
    acceptImages,
    removeAttachment,
  };
}
