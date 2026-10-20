"use client";

import { useCanvasStore } from "@/features/canvas/store";
import { saveLocal } from "@/features/canvas/persistence";
import type { ImageNodeData } from "@/features/canvas/types";
import type { ImageJobInput, ImageJobLink, ImageJobResponse } from "./image-job-types";

const ROOT = "/api/v1/ai/image-jobs";
const submitting = new Map<string, Promise<void>>();
const configSubmissions = new Set<string>();
const monitors = new Map<
  string,
  { timer?: ReturnType<typeof setTimeout>; stopped: boolean; controller?: AbortController }
>();

class ImageJobHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
      : AbortSignal.timeout(15_000),
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as {
      error?: string;
      details?: string[];
    };
    throw new ImageJobHttpError(
      response.status,
      detail.details?.[0] ?? detail.error ?? `Request failed (${response.status})`,
    );
  }
  return response.json() as Promise<T>;
}

function key(): string {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function persist(canvasId: string | null) {
  const state = useCanvasStore.getState();
  if (canvasId && state.canvasId === canvasId) saveLocal(canvasId, state.nodes, state.edges);
}

function members(canvasId: string | null, submissionKey?: string, jobId?: string) {
  const state = useCanvasStore.getState();
  if (state.canvasId !== canvasId) return [];
  return state.nodes.filter((node) => {
    const data = node.data as ImageNodeData;
    return (
      node.type === "image" &&
      data.imageJob &&
      ((submissionKey !== undefined && data.imageJob.key === submissionKey) ||
        (jobId !== undefined && data.jobId === jobId))
    );
  });
}

function applyJob(
  canvasId: string | null,
  job: ImageJobResponse,
  submissionKey?: string,
  createMissing = false,
) {
  const state = useCanvasStore.getState();
  if (state.canvasId !== canvasId) return;
  let targets = members(canvasId, submissionKey, job.jobId);
  if (
    !targets.length &&
    createMissing &&
    job.nodeId &&
    state.nodes.some((node) => node.id === job.nodeId)
  ) {
    const count = Math.min(4, Math.max(1, job.input.count));
    for (let index = 0; index < count; index++) {
      state.spawnOutput(
        job.nodeId,
        "image",
        {
          jobId: job.jobId,
          imageJob: { key: job.jobId, input: job.input, index },
          execution: { runId: job.jobId, status: "queued", startedAt: Date.parse(job.createdAt) },
        },
        state.edges.filter((edge) => edge.source === job.nodeId).length + index,
      );
    }
    targets = members(canvasId, undefined, job.jobId);
  }
  const seen = new Set<number>();
  const remove: string[] = [];
  // 原任务节点优先，后端合并重复点击后移除新建的多余占位。
  targets.sort(
    (a, b) =>
      Number((b.data as ImageNodeData).jobId === job.jobId) -
      Number((a.data as ImageNodeData).jobId === job.jobId),
  );
  for (const node of targets) {
    const data = node.data as ImageNodeData;
    if (
      data.jobId === job.jobId &&
      data.imageJob?.status === "succeeded" &&
      job.status !== "succeeded"
    )
      continue;
    const link = data.imageJob!;
    const asset = job.assets.find((item) => item.index === link.index);
    if (seen.has(link.index) && !data.assetUrl) {
      remove.push(node.id);
      continue;
    }
    seen.add(link.index);
    if (job.status === "succeeded" && !asset && !data.assetUrl) {
      remove.push(node.id);
      continue;
    }
    const status = asset
      ? "succeeded"
      : job.status === "generating" || job.status === "saving"
        ? "running"
        : job.status;
    state.updateNodeData(
      node.id,
      {
        jobId: job.jobId,
        prompt: job.input.prompt,
        providerId: job.input.providerId,
        imageJob: {
          ...link,
          input: job.input,
          status: job.status,
          canRetryDownload: job.canRetryDownload,
          connectionLost: false,
        },
        // 已完成后用户可能旋转/裁剪过此图，重新查询不能覆盖这些编辑。
        ...(asset && (data.execution?.status !== "succeeded" || !data.assetUrl)
          ? { assetUrl: asset.url, mediaType: asset.mediaType }
          : {}),
        execution: {
          runId: data.execution?.runId ?? job.jobId,
          status,
          startedAt: Date.parse(job.createdAt),
          finishedAt: job.finishedAt ? Date.parse(job.finishedAt) : undefined,
          error: !asset ? (job.error ?? undefined) : undefined,
          phase:
            job.status === "queued" || job.status === "generating" || job.status === "saving"
              ? job.status
              : undefined,
        },
      },
      { history: false },
    );
  }
  if (remove.length) state.removeNodes(remove, { history: false });
  persist(canvasId);
}

function connectionLost(canvasId: string | null, submissionKey?: string, jobId?: string) {
  for (const node of members(canvasId, submissionKey, jobId)) {
    const data = node.data as ImageNodeData;
    useCanvasStore
      .getState()
      .updateNodeData(
        node.id,
        { imageJob: { ...data.imageJob!, connectionLost: true } },
        { history: false },
      );
  }
  persist(canvasId);
}

/** 只停止浏览器轮询，不取消或删除后台任务。 */
export function detachImageJobs(canvasId?: string | null) {
  for (const [id, monitor] of monitors) {
    if (canvasId !== undefined && !id.startsWith(`${canvasId}:`)) continue;
    monitor.stopped = true;
    clearTimeout(monitor.timer);
    monitor.controller?.abort();
    monitors.delete(id);
  }
}

function stopMonitor(canvasId: string | null, jobId?: string) {
  const id = `${canvasId}:${jobId}`;
  const monitor = monitors.get(id);
  if (!monitor) return;
  monitor.stopped = true;
  clearTimeout(monitor.timer);
  monitor.controller?.abort();
  monitors.delete(id);
}

function watch(
  canvasId: string | null,
  job: Pick<ImageJobResponse, "jobId" | "status">,
  initialDelay = 3000,
) {
  const id = `${canvasId}:${job.jobId}`;
  if (job.status === "failed" || job.status === "succeeded" || monitors.has(id)) return;
  const monitor: {
    timer?: ReturnType<typeof setTimeout>;
    stopped: boolean;
    controller?: AbortController;
  } = { stopped: false };
  monitors.set(id, monitor);
  const tick = async () => {
    if (monitor.stopped || !members(canvasId, undefined, job.jobId).length) {
      monitors.delete(id);
      return;
    }
    let delay = 3000;
    monitor.controller = new AbortController();
    try {
      const next = await request<ImageJobResponse>(
        `${ROOT}/${job.jobId}`,
        undefined,
        monitor.controller.signal,
      );
      if (monitor.stopped) return;
      applyJob(canvasId, next);
      if (next.status === "succeeded" || next.status === "failed") {
        monitors.delete(id);
        return;
      }
    } catch (error) {
      if (monitor.stopped) return;
      connectionLost(canvasId, undefined, job.jobId);
      // 登录失效或任务不可访问时停止，保留手动查询入口。
      if (error instanceof ImageJobHttpError && [401, 403, 404].includes(error.status)) {
        monitors.delete(id);
        return;
      }
      delay = 10_000;
    }
    monitor.timer = setTimeout(() => void tick(), delay);
  };
  monitor.timer = setTimeout(() => void tick(), initialDelay);
}

async function submit(canvasId: string | null, link: ImageJobLink) {
  const token = `${canvasId}:${link.key}`;
  const existing = submitting.get(token);
  if (existing) return existing;
  const operation = (async () => {
    try {
      const job = await request<ImageJobResponse>(
        link.regenerateFrom ? `${ROOT}/${link.regenerateFrom}/regenerate` : ROOT,
        link.regenerateFrom ? { key: link.key } : { key: link.key, input: link.input },
      );
      applyJob(canvasId, job, link.key);
      if (useCanvasStore.getState().canvasId === canvasId) watch(canvasId, job);
    } catch (error) {
      connectionLost(canvasId, link.key);
      // 只有明确的客户端拒绝才能标记失败。500/断网仍可能已接受，保留 Key 供只读查询。
      if (error instanceof ImageJobHttpError && error.status >= 400 && error.status < 500) {
        for (const node of members(canvasId, link.key)) {
          const data = node.data as ImageNodeData;
          useCanvasStore.getState().updateNodeData(
            node.id,
            {
              imageJob: { ...data.imageJob!, status: "failed", connectionLost: false },
            },
            { history: false },
          );
          useCanvasStore
            .getState()
            .patchExecution(node.id, "failed", { error: error.message, phase: undefined });
        }
      }
      persist(canvasId);
    }
  })();
  submitting.set(token, operation);
  try {
    await operation;
  } finally {
    submitting.delete(token);
  }
}

/** 提交前同步缓存输入与 Key；同一配置提交期间的重复点击直接合并。 */
export async function startImageJob(
  nodeId: string,
  input: ImageJobInput,
  modelId?: string,
  regenerateFrom?: string,
) {
  const state = useCanvasStore.getState();
  const canvasId = state.canvasId;
  const configKey = `${canvasId}:${nodeId}`;
  if (configSubmissions.has(configKey)) return;
  configSubmissions.add(configKey);
  try {
    const submissionKey = key();
    const base = state.edges.filter((edge) => edge.source === nodeId).length;
    for (let index = 0; index < input.count; index++)
      state.spawnOutput(
        nodeId,
        "image",
        {
          prompt: input.prompt,
          providerId: input.providerId,
          modelId,
          imageJob: { key: submissionKey, input, index, regenerateFrom },
          execution: {
            runId: submissionKey,
            status: "queued",
            phase: "submitting",
            startedAt: Date.now(),
          },
        },
        base + index,
      );
    persist(canvasId);
    await submit(canvasId, { key: submissionKey, input, index: 0, regenerateFrom });
  } finally {
    configSubmissions.delete(configKey);
  }
}

/** 包括响应丢失时按提交 Key 查询：绝不 POST，不触发付费。 */
export async function queryImageJob(nodeId: string) {
  const state = useCanvasStore.getState();
  const data = state.nodes.find((node) => node.id === nodeId)?.data as ImageNodeData | undefined;
  if (!data?.imageJob) return;
  stopMonitor(state.canvasId, data.jobId);
  try {
    const job = await request<ImageJobResponse>(
      data.jobId ? `${ROOT}/${data.jobId}` : `${ROOT}/by-submission/${data.imageJob.key}`,
    );
    applyJob(state.canvasId, job, data.imageJob.key);
    if (useCanvasStore.getState().canvasId === state.canvasId) watch(state.canvasId, job);
  } catch (error) {
    connectionLost(state.canvasId, data.imageJob.key, data.jobId);
    if (
      data.jobId &&
      useCanvasStore.getState().canvasId === state.canvasId &&
      !(error instanceof ImageJobHttpError && [401, 403, 404].includes(error.status))
    ) {
      watch(
        state.canvasId,
        { jobId: data.jobId, status: data.imageJob.status ?? "queued" },
        10_000,
      );
    }
    throw error;
  }
}

/** 恢复下载不发送提示词、模型或新 Key，后台只使用已有检查点。 */
export async function retryImageDownload(nodeId: string) {
  const state = useCanvasStore.getState();
  const data = state.nodes.find((node) => node.id === nodeId)?.data as ImageNodeData | undefined;
  if (!data?.jobId) return;
  stopMonitor(state.canvasId, data.jobId);
  try {
    const job = await request<ImageJobResponse>(`${ROOT}/${data.jobId}/retry-download`, {});
    applyJob(state.canvasId, job);
    if (useCanvasStore.getState().canvasId === state.canvasId) watch(state.canvasId, job);
  } catch (error) {
    if (!(error instanceof ImageJobHttpError && error.status >= 400 && error.status < 500)) {
      connectionLost(state.canvasId, undefined, data.jobId);
      // 恢复可能已入队但响应丢失，只通过 GET 确认，绝不重发生成。
      if (useCanvasStore.getState().canvasId === state.canvasId)
        watch(state.canvasId, { jobId: data.jobId, status: "queued" }, 10_000);
    }
    throw error;
  }
}

/** 调用方必须先显示再次付费确认；新任务保留原图，使用原参数而不是当前配置。 */
export async function regenerateImageJob(nodeId: string) {
  const state = useCanvasStore.getState();
  const data = state.nodes.find((node) => node.id === nodeId)?.data as ImageNodeData | undefined;
  if (!data?.imageJob) return;
  // 首次响应未知时复用原 Key，防止“重新提交”变成第二次付费。
  if (!data.jobId) {
    await submit(state.canvasId, data.imageJob);
    return;
  }
  const configId = data.imageJob.input.nodeId;
  if (!configId || !state.nodes.some((node) => node.id === configId))
    throw new Error("原生成节点已删除，请先恢复节点。");
  await startImageJob(configId, data.imageJob.input, data.modelId, data.jobId);
}

/** 刷新后恢复已有任务；只补回快照之后接受的任务，避免复活用户早已删除的结果节点。 */
export async function resumeImageJobs(canvasId: string, snapshotTime = 0) {
  const seen = new Set<string>();
  const lookups: Promise<void>[] = [];
  for (const node of useCanvasStore.getState().nodes) {
    const data = node.data as ImageNodeData;
    if (node.type !== "image" || !data.imageJob) continue;
    const identity = data.jobId ?? data.imageJob.key;
    if (seen.has(identity)) continue;
    seen.add(identity);
    lookups.push(queryImageJob(node.id).catch(() => {}));
  }
  await Promise.all(lookups);
  let before: string | undefined;
  do {
    if (useCanvasStore.getState().canvasId !== canvasId) return;
    let page: { items: ImageJobResponse[]; nextCursor?: string | null };
    try {
      page = await request(
        `${ROOT}?canvasId=${encodeURIComponent(canvasId)}${before ? `&before=${encodeURIComponent(before)}` : ""}`,
      );
    } catch {
      return;
    }
    if (useCanvasStore.getState().canvasId !== canvasId) return;
    for (const job of page.items) {
      const known = members(canvasId, undefined, job.jobId).length > 0;
      if (!known && Date.parse(job.createdAt) <= snapshotTime) continue;
      applyJob(canvasId, job, undefined, true);
      watch(canvasId, job);
    }
    before = page.items.some((job) => Date.parse(job.createdAt) <= snapshotTime)
      ? undefined
      : (page.nextCursor ?? undefined);
  } while (before);
}
