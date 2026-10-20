/**
 * 画布节点模型。
 *
 * 从 OpenCowork 图类型移植。渲染使用 @xyflow/react 而不是手写画布，
 * 但保留数据模型和执行语义：四种节点、共享执行快照，
 * 以及位于独立节点而非图片节点内部的生成配置。
 *
 * 使用独立配置节点的原因：一个配置可提供多个输出；同一提示词连接到两个配置节点后，
 * 可使用两个不同模型运行。若把设置折叠进图片节点，两种用法都会变得笨拙。
 */

export type NodeKind = "text" | "image" | "video" | "imageGen" | "videoGen";

export type ExecutionStatus =
  | "idle"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  /** 标签页在运行中关闭。不同于失败：对结果一无所知。 */
  | "interrupted";

export interface NodeExecution {
  /**
   * 标识一次尝试。
   *
   * 由一次运行产生的所有节点共享，使从任一节点取消都能停止整个运行，
   * 也让延迟响应能发现用户已经删除了相关节点。
   */
  runId: string;
  status: ExecutionStatus;
  startedAt?: number;
  finishedAt?: number;
  /** 0～1，仅对视频有意义。 */
  progress?: number;
  error?: string;
  /** 图片后台任务的真实阶段；不伪造上游百分比。 */
  phase?: "submitting" | "queued" | "generating" | "saving";
}

export interface TextNodeData {
  text: string;
  /** 应用于基础字号的倍数，可按节点调整。 */
  fontScale?: number;
}

export interface ImageNodeData {
  jobId?: string;
  imageJob?: import("./image-job-types").ImageJobLink;
  /** 服务器素材 URL。持久化状态中绝不是数据 URL，参见 persistence.ts。 */
  assetUrl?: string;
  mediaType?: string;
  /** 生成此图片的提示词；图片重新作为参考输入时复用。 */
  prompt?: string;
  providerId?: string;
  modelId?: string;
  /** 将此素材标记为局部重绘蒙版，而不是普通参考图。 */
  role?: "reference" | "inpaint-mask";
  execution?: NodeExecution;
}

export interface VideoNodeData {
  assetUrl?: string;
  posterUrl?: string;
  /** 服务器派生的缓存末帧，可安全作为图片输入。 */
  lastFrameUrl?: string;
  lastFrameMediaType?: string;
  mediaType?: string;
  prompt?: string;
  providerId?: string;
  modelId?: string;
  /** 服务器端任务，轮询至到达终止状态。 */
  jobId?: string;
  execution?: NodeExecution;
}

export type AspectRatio = "1:1" | "3:2" | "2:3" | "16:9" | "9:16" | "4:3" | "3:4";

/** 向供应商请求的编码。 */
export type ImageOutputFormat = "png" | "jpeg" | "webp";

export interface ImageGenNodeData {
  providerId?: string;
  modelId?: string;
  aspect?: AspectRatio;
  /** 显式像素尺寸；设置后覆盖画面比例。 */
  size?: string;
  quality?: "auto" | "low" | "medium" | "high";
  outputFormat?: ImageOutputFormat;
  /** 请求图片数量，范围为 1～4。 */
  count?: number;
  seed?: number;
  /**
   * 尚未到达独立节点的失败，例如上游未连接、模型消失或请求被拒绝。
   * 进行中的运行状态位于其创建的图片节点，而不在此处，使第二次运行不会与第一次竞争。
   */
  execution?: NodeExecution;
}

export interface VideoGenNodeData {
  providerId?: string;
  modelId?: string;
  aspect?: AspectRatio;
  resolution?: "480p" | "720p" | "1080p";
  /** 秒。 */
  duration?: number;
  fps?: number;
  seed?: number;
  watermark?: boolean;
  generateAudio?: boolean;
  cameraFixed?: boolean;
  /** Seedance 与 H3 原生协议的媒体模式；保留字段名以兼容已保存画布。 */
  seedanceInputMode?: SeedanceVideoInputMode;
  /** 与 `ImageGenNodeData` 相同：只记录尚未到达独立节点的失败。 */
  execution?: NodeExecution;
}

export type SeedanceVideoInputMode = "reference" | "first-last";

export const DEFAULT_SEEDANCE_INPUT_MODE: SeedanceVideoInputMode = "reference";

export type CanvasNodeData =
  TextNodeData | ImageNodeData | VideoNodeData | ImageGenNodeData | VideoGenNodeData;

/** 各类型的默认框尺寸，与 OpenCowork 比例一致。 */
export const NODE_DEFAULT_SIZE: Record<NodeKind, { width: number; height: number }> = {
  text: { width: 280, height: 160 },
  image: { width: 320, height: 320 },
  video: { width: 360, height: 240 },
  imageGen: { width: 300, height: 340 },
  videoGen: { width: 300, height: 380 },
};

export const NODE_MIN_SIZE = { width: 160, height: 100 };

export const ASPECT_RATIOS: readonly AspectRatio[] = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
];

/** 同时用作标签文字；API 自身拼写无需翻译即可清晰理解。 */
export const IMAGE_OUTPUT_FORMATS: readonly ImageOutputFormat[] = ["png", "jpeg", "webp"];

/** 服务器的回退值；在此镜像，使标签显示实际会发送的值。 */
export const DEFAULT_IMAGE_OUTPUT_FORMAT: ImageOutputFormat = "png";

export const VIDEO_DURATION_MIN = 1;
export const VIDEO_DURATION_MAX = 15;
export const DEFAULT_VIDEO_DURATION = 5;

export function isValidVideoDuration(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= VIDEO_DURATION_MIN &&
    value <= VIDEO_DURATION_MAX
  );
}

export function resolveVideoDuration(value: number | undefined): number | null {
  const duration = value ?? DEFAULT_VIDEO_DURATION;
  return isValidVideoDuration(duration) ? duration : null;
}

/**
 * 将画面比例映射为 OpenAI 图片 API 接受的像素尺寸。
 *
 * 该 API 接受离散尺寸而不是比例，并拒绝其他值；因此没有精确匹配的比例会落到最近的受支持尺寸。
 */
export const ASPECT_TO_SIZE: Record<AspectRatio, string> = {
  "1:1": "1024x1024",
  "3:2": "1536x1024",
  "2:3": "1024x1536",
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "4:3": "1536x1024",
  "3:4": "1024x1536",
};

export function isTerminal(status: ExecutionStatus): boolean {
  return (
    status === "succeeded" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "interrupted"
  );
}
