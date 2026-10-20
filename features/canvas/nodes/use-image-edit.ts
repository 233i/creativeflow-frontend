"use client";

import { useCallback, useState } from "react";
import { applyImageEdit } from "@/features/canvas/image-edit";
import {
  cropImage,
  type CropRect,
  expandCanvas,
  type FlipAxis,
  flipImage,
  resizeImage,
  rotateImage,
  upscaleImage,
} from "@/features/canvas/image-ops";
import { useCanvasStore } from "@/features/canvas/store";

/**
 * 在本地编辑图片并将结果放到画布上。
 *
 * 结果会成为新节点，而不是替换源图片。编辑具有探索性：用户裁剪后若不满意，
 * 原图仍应保留；若唯一副本已被覆盖，仅靠撤销无法恢复它。
 *
 * 编辑后的字节数据通过常规上传接口保存，因此新节点与其他节点一样持有可持久使用的素材 URL。
 */
export function useImageEdit(nodeId: string, sourceUrl: string | undefined) {
  const spawnOutput = useCanvasStore((state) => state.spawnOutput);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(
    async (produce: (url: string) => Promise<Blob>, label: string): Promise<boolean> => {
      if (!sourceUrl || busy) return false;

      setBusy(true);
      setError(null);

      try {
        await applyImageEdit(nodeId, sourceUrl, produce, label, {}, { spawn: spawnOutput });
        return true;
      } catch (editError) {
        setError(editError instanceof Error ? editError.message : "Edit failed");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [nodeId, sourceUrl, busy, spawnOutput],
  );

  return {
    busy,
    error,
    clearError: () => setError(null),

    rotate: (quarterTurns: number) => apply((url) => rotateImage(url, quarterTurns), "rotated"),

    flip: (axis: FlipAxis) => apply((url) => flipImage(url, axis), "flipped"),

    upscale: (factor: number) => apply((url) => upscaleImage(url, factor), "upscaled"),

    crop: (rect: CropRect) => apply((url) => cropImage(url, rect), "cropped"),

    /**
     * 用透明边距扩展画布，为扩图做好准备。
     *
     * 此操作只生成输入素材，不直接调用模型；用户随后将结果连接到图片生成节点，
     * 让所有模型调用继续沿用同一条路径。
     */
    expand: (insets: { top: number; right: number; bottom: number; left: number }) =>
      apply((url) => expandCanvas(url, insets), "expanded"),

    resize: (width: number, height: number) =>
      apply((url) => resizeImage(url, width, height), "resized"),
  };
}
