"use client";

import { useCallback, useEffect } from "react";
import { uploadAsset } from "@/features/ai/api";
import { type CanvasNode, useCanvasStore } from "@/features/canvas/store";
import { NODE_DEFAULT_SIZE } from "@/features/canvas/types";

/**
 * 将拖入或粘贴的图片文件转换为图片节点。
 *
 * 粘贴处理器和画布放置目标共享此流程：先上传，再使用持久 URL 创建节点。
 * 若根据对象 URL 创建节点，会重新引入图片在重新加载后消失、作为生成参考时被忽略的问题。
 */
export function useImageDrop() {
  const addNode = useCanvasStore((state) => state.addNode);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);

  return useCallback(
    async (files: File[], at: { x: number; y: number }) => {
      const images = files.filter((file) => file.type.startsWith("image/"));

      for (const [index, file] of images.entries()) {
        // 节点立即出现，使放置操作感觉即时；上传完成后再写入 URL。
        const id = addNode("image", {
          x: at.x + index * 32,
          y: at.y + index * 32,
        });

        try {
          const asset = await uploadAsset(file);
          updateNodeData(id, { assetUrl: asset.url, mediaType: asset.mediaType });
        } catch {
          // 节点保留为空上传目标而不消失，使用户可直接在节点上重试。
        }
      }
    },
    [addNode, updateNodeData],
  );
}

/**
 * 将剪贴板图片粘贴到画布。
 *
 * 焦点位于文本字段时忽略，因为此时粘贴表示插入文本。
 */
export function usePasteImages(
  onFiles: (files: File[], at: { x: number; y: number }) => void,
  center: () => { x: number; y: number },
) {
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;

      const files = [...(event.clipboardData?.files ?? [])].filter((file) =>
        file.type.startsWith("image/"),
      );
      if (files.length === 0) return;

      event.preventDefault();
      onFiles(files, center());
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFiles, center]);
}

/** 放置节点时让放置点成为其中心，而不是左上角。 */
export function centredAt(
  point: { x: number; y: number },
  kind: keyof typeof NODE_DEFAULT_SIZE,
): { x: number; y: number } {
  const size = NODE_DEFAULT_SIZE[kind];
  return { x: point.x - size.width / 2, y: point.y - size.height / 2 };
}

/**
 * 将图片节点中的像素复制到系统剪贴板。
 *
 * 素材 URL 需要 Cookie 认证，因此创建 ClipboardItem 前必须先获取图片。
 * PNG 是互操作性最好的图片剪贴板格式；其他受支持画布图片格式会先栅格化为 PNG，
 * 使 JPEG、WebP 和 GIF 素材能在只接受 PNG 剪贴板表示的浏览器中工作。
 */
export async function copyImageToClipboard(url: string, mediaType?: string): Promise<void> {
  const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  const ClipboardItemConstructor = globalThis.ClipboardItem;
  if (!clipboard?.write || !ClipboardItemConstructor) {
    throw new Error("Image clipboard is not supported.");
  }

  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error("The image could not be loaded.");

  const source = await response.blob();
  const sourceType = source.type.toLowerCase();
  const declaredType = mediaType?.toLowerCase();
  const type = sourceType.startsWith("image/")
    ? sourceType
    : declaredType?.startsWith("image/")
      ? declaredType
      : "image/png";
  const typedSource = source.type === type ? source : new Blob([source], { type });
  const image = type === "image/png" ? typedSource : await rasterizeAsPng(typedSource);

  await clipboard.write([new ClipboardItemConstructor({ "image/png": image })]);
}

async function rasterizeAsPng(source: Blob): Promise<Blob> {
  const objectUrl = URL.createObjectURL(source);

  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(source);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, bitmap.width);
        canvas.height = Math.max(1, bitmap.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("A 2D canvas context is unavailable.");
        context.drawImage(bitmap, 0, 0);
        return await canvasToBlob(canvas);
      } finally {
        bitmap.close();
      }
    }

    const image = await loadImage(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, image.naturalWidth || image.width);
    canvas.height = Math.max(1, image.naturalHeight || image.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("A 2D canvas context is unavailable.");
    context.drawImage(image, 0, 0);
    return await canvasToBlob(canvas);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be decoded."));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The image could not be encoded."))),
      "image/png",
    );
  });
}

/** 当前选中的节点，供作用于选区的命令使用。 */
export function selectedNodes(): CanvasNode[] {
  return useCanvasStore.getState().nodes.filter((node) => node.selected);
}
