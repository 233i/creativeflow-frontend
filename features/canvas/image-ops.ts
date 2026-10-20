"use client";

/**
 * 本地图片操作。
 *
 * 裁剪、旋转、翻转和放大完全在 `<canvas>` 中运行，不使用模型和网络，也不产生费用。
 * OpenCowork 也采用相同方式；这很重要，因为把 90° 旋转交给图片模型既慢又昂贵，
 * 还无法真正保留原图。
 *
 * 每项操作都返回 `Blob`，使调用方可通过正常素材路径上传并获得持久 URL，
 * 而不是把像素保存在图中。
 */

export type FlipAxis = "horizontal" | "vertical";

export interface CropRect {
  /** 相对于源尺寸的 0～1 比例，使矩形在预览调整大小后仍能保持。 */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 用户请求调整大小时允许的最大边长，用于限制画布内存。 */
export const MAX_IMAGE_EDGE = 8192;

/**
 * 加载图片以执行画布操作。
 *
 * 设置 `crossOrigin`，因为素材路由虽为同源，但开发环境中通过重写提供；
 * 若不设置，后续 `toBlob` 会因画布被污染而抛出 SecurityError。
 */
async function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be loaded."));
    image.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, mediaType: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The canvas produced no data."))),
      mediaType,
      // 只对有损类型使用。数值足够高，避免重复编辑造成明显质量下降。
      0.95,
    );
  });
}

function context(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("A 2D canvas context is unavailable.");

  // 对放大最为重要，默认设置会产生明显像素块。
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  return [canvas, ctx];
}

export async function cropImage(
  url: string,
  rect: CropRect,
  mediaType = "image/png",
): Promise<Blob> {
  const image = await load(url);

  const sx = Math.round(rect.x * image.naturalWidth);
  const sy = Math.round(rect.y * image.naturalHeight);
  const sw = Math.max(1, Math.round(rect.width * image.naturalWidth));
  const sh = Math.max(1, Math.round(rect.height * image.naturalHeight));

  const [canvas, ctx] = context(sw, sh);
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);

  return toBlob(canvas, mediaType);
}

/** 按四分之一圈旋转。只允许 90° 的倍数，使结果保持矩形。 */
export async function rotateImage(
  url: string,
  quarterTurns: number,
  mediaType = "image/png",
): Promise<Blob> {
  const image = await load(url);
  const turns = ((quarterTurns % 4) + 4) % 4;

  const swapped = turns === 1 || turns === 3;
  const width = swapped ? image.naturalHeight : image.naturalWidth;
  const height = swapped ? image.naturalWidth : image.naturalHeight;

  const [canvas, ctx] = context(width, height);

  ctx.translate(width / 2, height / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

  return toBlob(canvas, mediaType);
}

export async function flipImage(
  url: string,
  axis: FlipAxis,
  mediaType = "image/png",
): Promise<Blob> {
  const image = await load(url);
  const [canvas, ctx] = context(image.naturalWidth, image.naturalHeight);

  if (axis === "horizontal") {
    ctx.translate(image.naturalWidth, 0);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(0, image.naturalHeight);
    ctx.scale(1, -1);
  }

  ctx.drawImage(image, 0, 0);

  return toBlob(canvas, mediaType);
}

export async function upscaleImage(
  url: string,
  factor: number,
  mediaType = "image/png",
): Promise<Blob> {
  const image = await load(url);

  const clamped = Math.min(
    factor,
    MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const scale = Math.max(1, clamped);

  const [canvas, ctx] = context(image.naturalWidth * scale, image.naturalHeight * scale);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  return toBlob(canvas, mediaType);
}

/** 调整为明确目标尺寸并返回新图片，不修改源节点。 */
export async function resizeImage(
  url: string,
  width: number,
  height: number,
  mediaType = "image/png",
): Promise<Blob> {
  const targetWidth = Math.round(width);
  const targetHeight = Math.round(height);
  if (
    !Number.isFinite(targetWidth) ||
    !Number.isFinite(targetHeight) ||
    targetWidth < 1 ||
    targetHeight < 1 ||
    targetWidth > MAX_IMAGE_EDGE ||
    targetHeight > MAX_IMAGE_EDGE
  ) {
    throw new Error("The requested image size is not supported.");
  }

  const image = await load(url);
  const [canvas, ctx] = context(targetWidth, targetHeight);
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  return toBlob(canvas, mediaType);
}

/**
 * 扩展图片周围的画布，并让新增区域保持透明。
 *
 * 这是扩图所需的输入：模型会填充所有透明区域。边距使用源尺寸的比例表示。
 *
 * 始终生成 PNG；透明度就是负载，而有损格式没有透明通道，因此没有其他媒体类型可选。
 */
export async function expandCanvas(
  url: string,
  insets: { top: number; right: number; bottom: number; left: number },
): Promise<Blob> {
  const image = await load(url);

  const left = Math.round(insets.left * image.naturalWidth);
  const right = Math.round(insets.right * image.naturalWidth);
  const top = Math.round(insets.top * image.naturalHeight);
  const bottom = Math.round(insets.bottom * image.naturalHeight);

  const [canvas, ctx] = context(
    image.naturalWidth + left + right,
    image.naturalHeight + top + bottom,
  );

  // 不填充：未触及区域保持透明，用于标记“在此生成”。
  ctx.drawImage(image, left, top);

  return toBlob(canvas, "image/png");
}

/**
 * 构建局部重绘所需的蒙版。
 *
 * OpenAI images/edits 的约定比较反直觉：**绘制像素会被挖成透明**，模型恰好重新生成这些区域。
 * 若蒙版把它们填成不透明，反而会重新生成其他所有区域。
 */
export async function buildInpaintMask(
  url: string,
  strokes: Array<{ points: Array<{ x: number; y: number }>; radius: number }>,
): Promise<Blob> {
  const image = await load(url);
  const [canvas, ctx] = context(image.naturalWidth, image.naturalHeight);

  // 从原图开始，使未绘制区域保留真实像素，再从中挖出透明孔洞。
  ctx.drawImage(image, 0, 0);
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,1)";

  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;

    ctx.lineWidth = stroke.radius * 2 * image.naturalWidth;
    ctx.beginPath();

    const [first, ...rest] = stroke.points;
    ctx.moveTo(first.x * image.naturalWidth, first.y * image.naturalHeight);

    if (rest.length === 0) {
      // 单次点击也必须擦除一些内容。
      ctx.lineTo(first.x * image.naturalWidth + 0.01, first.y * image.naturalHeight);
    } else {
      for (const point of rest) {
        ctx.lineTo(point.x * image.naturalWidth, point.y * image.naturalHeight);
      }
    }

    ctx.stroke();
  }

  // 只使用 PNG：透明度就是负载。
  return toBlob(canvas, "image/png");
}

/** 将生成的 Blob 包装为 File，使其可通过正常上传端点。 */
export function toUploadFile(blob: Blob, name = "edited"): File {
  const extension = blob.type === "image/jpeg" ? "jpg" : blob.type.split("/")[1] || "png";
  return new File([blob], `${name}.${extension}`, { type: blob.type });
}
