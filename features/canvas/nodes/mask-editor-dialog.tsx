"use client";

import { Eraser, Loader2, Undo2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { uploadAsset } from "@/features/ai/api";
import { buildInpaintMask, toUploadFile } from "@/features/canvas/image-ops";
import { useCanvasStore } from "@/features/canvas/store";

interface Stroke {
  points: Array<{ x: number; y: number }>;
  radius: number;
}

/** 画笔大小以图片宽度的比例表示，使笔画可随图片一起缩放。 */
const BRUSH_SIZES = [0.02, 0.05, 0.1] as const;

/**
 * 绘制需要重新生成的区域，然后生成局部重绘所需的蒙版图片。
 *
 * 输出方式有些反直觉：按照 OpenAI images/edits 接口的约定，**被涂画的像素会变为透明**，
 * 模型只重新生成这些区域；若将它们填充为不透明，则会重新生成其他所有区域。
 * `buildInpaintMask` 负责处理这一规则，本组件只收集笔画。
 *
 * 结果会成为一个新图片节点，用户可将其连接到生成节点。模型调用仍沿用现有统一路径，
 * 因而无需为局部重绘增加特殊流程。
 */
export function MaskEditorDialog({
  onOpenChange,
  nodeId,
  sourceUrl,
}: {
  onOpenChange: (open: boolean) => void;
  nodeId: string;
  sourceUrl: string;
}) {
  const t = useT();
  const spawnOutput = useCanvasStore((state) => state.spawnOutput);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [radius, setRadius] = useState<number>(BRUSH_SIZES[1]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);

  /**
   * 绘制区域的显示尺寸。
   *
   * 笔画以比例保存，因此调整尺寸后仍然有效；但预览必须使用像素绘制：0～1 的 SVG viewBox
   * 无法在非正方形元素上表达圆形画笔，百分比描边宽度也无法按该元素正确换算。
   */
  const [surfaceSize, setSurfaceSize] = useState({ width: 0, height: 0 });

  const measure = useCallback((node: HTMLDivElement | null) => {
    surfaceRef.current = node;
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      setSurfaceSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /** 指针位置以图片尺寸比例表示，使笔画适用于任意预览尺寸。 */
  const toFraction = useCallback((event: React.PointerEvent) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return null;

    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }, []);

  function start(event: React.PointerEvent) {
    const point = toFraction(event);
    if (!point) return;

    // 捕获指针，确保拖动途中即使指针离开绘制区域，笔画也能继续。
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    setStrokes((current) => [...current, { points: [point], radius }]);
  }

  function extend(event: React.PointerEvent) {
    if (!drawing.current) return;

    const point = toFraction(event);
    if (!point) return;

    setStrokes((current) => {
      if (current.length === 0) return current;

      const last = current[current.length - 1];
      return [...current.slice(0, -1), { ...last, points: [...last.points, point] }];
    });
  }

  function end() {
    drawing.current = false;
  }

  async function apply() {
    if (strokes.length === 0 || busy) return;

    setBusy(true);
    setError(null);

    try {
      const mask = await buildInpaintMask(sourceUrl, strokes);
      const asset = await uploadAsset(toUploadFile(mask, "masked"));

      spawnOutput(nodeId, "image", {
        assetUrl: asset.url,
        mediaType: asset.mediaType,
        role: "inpaint-mask",
      });
      onOpenChange(false);
    } catch (maskError) {
      setError(maskError instanceof Error ? maskError.message : t("errors.unknown"));
      setBusy(false);
    }
  }

  return (
    <Dialog
      isOpen
      onOpenChange={onOpenChange}
      className="w-[min(44rem,calc(100vw-2rem))] max-w-none sm:max-w-none"
    >
      <DialogHeader>
        <DialogTitle>{t("node.maskEdit")}</DialogTitle>
        <DialogDescription>{t("node.maskEditHint")}</DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("node.brushSize")}</span>
        {BRUSH_SIZES.map((size, index) => (
          <button
            key={size}
            type="button"
            onClick={() => setRadius(size)}
            aria-label={`${t("node.brushSize")} ${index + 1}`}
            className={`flex size-7 items-center justify-center rounded-md border transition-colors ${
              radius === size ? "border-primary bg-accent" : "border-border hover:bg-accent/50"
            }`}
          >
            <span
              className="rounded-full bg-foreground"
              style={{ width: 4 + index * 5, height: 4 + index * 5 }}
            />
          </button>
        ))}

        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          isDisabled={strokes.length === 0}
          onPress={() => setStrokes((current) => current.slice(0, -1))}
        >
          <Undo2 className="size-3.5" aria-hidden />
          {t("canvas.undo")}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          isDisabled={strokes.length === 0}
          onPress={() => setStrokes([])}
        >
          <Eraser className="size-3.5" aria-hidden />
          {t("node.clearMask")}
        </Button>
      </div>

      <div
        ref={measure}
        onPointerDown={start}
        onPointerMove={extend}
        onPointerUp={end}
        onPointerCancel={end}
        className="relative max-h-[52vh] cursor-crosshair touch-none overflow-hidden rounded-lg border bg-muted/20 select-none"
      >
        {/* 使用 Cookie 认证的路由，next/image 无法获取。 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sourceUrl}
          alt=""
          className="pointer-events-none block max-h-[52vh] w-full object-contain"
          draggable={false}
        />

        {/* 仅用于预览；应用时会按原始分辨率渲染真正的蒙版。这里使用像素绘制，
            使画笔在非正方形区域上仍保持圆形。 */}
        <svg className="pointer-events-none absolute inset-0 size-full">
          {strokes.map((stroke, index) => (
            <polyline
              key={index}
              points={stroke.points
                .map((point) => `${point.x * surfaceSize.width},${point.y * surfaceSize.height}`)
                .join(" ")}
              fill="none"
              stroke="rgba(239,68,68,0.55)"
              strokeWidth={stroke.radius * 2 * surfaceSize.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <DialogFooter>
        <Button variant="outline" size="sm" onPress={() => onOpenChange(false)}>
          {t("common.cancel")}
        </Button>
        <Button size="sm" isDisabled={strokes.length === 0 || busy} onPress={() => void apply()}>
          {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {t("node.createMasked")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
