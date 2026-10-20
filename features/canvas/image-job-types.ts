/** 后端图片任务的公开契约，不包含服务商密钥或上游下载地址。 */
export interface ImageJobInput {
  providerId: string;
  modelKey: string;
  prompt: string;
  images: string[];
  maskUrl?: string;
  size?: string;
  quality?: string;
  outputFormat?: string;
  count: number;
  seed?: number;
  canvasId?: string | null;
  nodeId?: string;
}

export interface ImageJobResponse {
  jobId: string;
  status: "queued" | "generating" | "saving" | "succeeded" | "failed";
  failureStage?: string | null;
  error?: string | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  canRetryDownload: boolean;
  canvasId?: string | null;
  nodeId?: string | null;
  input: ImageJobInput;
  assets: { index: number; url: string; mediaType: string; assetId: string }[];
}

/** 提交前写入本地快照，即使 202 响应丢失也能按原 Key 查询，而不是再次付费。 */
export interface ImageJobLink {
  key: string;
  input: ImageJobInput;
  index: number;
  regenerateFrom?: string;
  status?: ImageJobResponse["status"];
  canRetryDownload?: boolean;
  connectionLost?: boolean;
}
