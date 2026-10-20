"use client";

import type { CanvasEdge, CanvasNode } from "@/features/canvas/store";
import { newRunId, useCanvasStore } from "@/features/canvas/store";
import { collectUpstream } from "@/features/canvas/upstream";
import {
  ASPECT_TO_SIZE,
  DEFAULT_SEEDANCE_INPUT_MODE,
  DEFAULT_IMAGE_OUTPUT_FORMAT,
  resolveVideoDuration,
  type ImageGenNodeData,
  type NodeExecution,
  type VideoGenNodeData,
} from "@/features/canvas/types";
import { useAiStore } from "@/features/ai/store";
import { startImageJob } from "@/features/canvas/image-jobs";

/**
 * 运行生成节点。
 *
 * 此处只负责编排：收集上游输入、调用后端，并将结果写回图中。提供商协议位于服务端，
 * 浏览器不会接触 API 密钥，也不会直接请求模型提供商。
 *
 * **一次运行属于它创建的节点，而不属于启动它的节点。** 每次点击“生成”都会创建独立的输出节点
 * 和运行 ID，加载指示器、进度、“停止”按钮及取消状态都保存在这些节点上。配置节点不保存运行状态，
 * 因而用户可在第一次仍在渲染时发起第二次生成。两个任务不会争用同一状态字段，较慢的首次结果
 * 也不会因后续任务替换了用于校验的 ID 而被丢弃。
 *
 * 配置节点仍会显示一种信息：任务在创建结果节点前就发生的错误（例如未连接上游、模型已移除或请求被拒绝）。
 */

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const parsed = (await response.json()) as { error?: string; details?: string[] };
      detail = parsed.details?.[0] ?? parsed.error ?? detail;
    } catch {
      // 保留根据状态码生成的消息。
    }
    throw new Error(detail);
  }

  return (await response.json()) as T;
}

/**
 * 正在进行的任务所用的中止控制器，以运行 ID 为键。
 *
 * 这里按运行而非节点索引，因为一个配置节点可以同时执行多个任务。若按节点索引，
 * 第二次“生成”会覆盖第一次记录，导致首次请求再也无法中止。
 *
 * 特意将其保存在状态仓库之外：AbortController 不可序列化，持久化它会破坏保存流程，
 * 而且页面重载后它本就失去意义。
 */
const inFlight = new Map<string, AbortController>();

function executionOf(node: CanvasNode | undefined): NodeExecution | undefined {
  return (node?.data as { execution?: NodeExecution } | undefined)?.execution;
}

/** 承载此次运行的节点，按画布顺序排列；用户删除全部节点后为空。 */
function runNodes(runId: string): CanvasNode[] {
  return useCanvasStore.getState().nodes.filter((node) => executionOf(node)?.runId === runId);
}

/**
 * 只要此次运行仍有可写入结果的位置，就返回 true。
 *
 * 用来替代过去针对配置节点运行 ID 的检查。只有用户停止任务或删除等待结果的节点时才丢弃结果，
 * 不会因为用户启动了另一个任务而丢弃。
 */
function runAlive(runId: string): boolean {
  return runNodes(runId).some((node) => executionOf(node)?.status !== "cancelled");
}

/**
 * 删除任务结束后仍为空的输出节点。
 *
 * 占位节点只有变成图片或视频后才有保留价值。任务结束时既没有素材也没有服务端任务的占位节点
 * 只会造成干扰，而且其加载指示器已无任何后续流程可以结束。
 *
 * 此操作不计入撤销记录：这些节点并非用户创建，用户也不会期望 Ctrl+Z 恢复一个永远无法填充的框。
 */
function discardPlaceholders(ids: string[]): void {
  const store = useCanvasStore.getState();

  const empty = ids.filter((id) => {
    const node = store.nodes.find((candidate) => candidate.id === id);
    if (!node) return false;

    const data = node.data as { assetUrl?: string; jobId?: string };
    return !data.assetUrl && !data.jobId;
  });

  if (empty.length > 0) {
    store.removeNodes(empty, { history: false });
  }
}

/**
 * 停止节点所属的运行任务。
 *
 * 由正在生成的节点调用，“停止”按钮也位于该节点。由于一次请求会产生此次运行的全部图片，
 * 因此会停止整个任务，而不只是被点击的节点。
 *
 * 视频任务在服务端运行，因此会解除本地轮询器并请求停止服务端任务。
 * 新图片任务不走此入口：浏览器无法取消已经提交的模型调用，不能误报为已停止。
 */
export function cancelRun(nodeId: string): void {
  const store = useCanvasStore.getState();
  // 图片一旦提交即独立在后台执行；不能把断开浏览器伪装为取消已付费生成。
  if ((store.nodes.find((node) => node.id === nodeId)?.data as { imageJob?: unknown })?.imageJob)
    return;

  const runId = executionOf(store.nodes.find((candidate) => candidate.id === nodeId))?.runId;
  if (!runId) return;

  inFlight.get(runId)?.abort();
  inFlight.delete(runId);

  const members = runNodes(runId);

  for (const member of members) {
    const jobId = (member.data as { jobId?: string }).jobId;

    if (jobId) {
      // 尽力而为：轮询器已停止，此处即使失败也只会在上游留下孤立任务，之后会由过期清理流程结束。
      void fetch(`/api/v1/ai/videos/${jobId}`, { method: "DELETE", credentials: "include" }).catch(
        () => {},
      );
    }

    // 若不处理，节点会永远显示加载状态，因为本应更新结果的轮询器刚刚已解除。
    store.patchExecution(member.id, "cancelled");
  }

  // 停止一个尚未产生任何内容的任务后，画布应恢复原状，而不是留下带“已停止”提示的空框。
  // 已被服务端接受的视频任务则保留节点：上游确实执行过操作，值得向用户展示。
  discardPlaceholders(members.map((member) => member.id));
}

function resolveModelKey(providerId: string, modelId: string): string | null {
  const provider = useAiStore.getState().providers.find((candidate) => candidate.id === providerId);

  if (!provider?.enabled) return null;

  const model = provider.models.find((candidate) => candidate.id === modelId);
  return model?.enabled ? model.modelKey : null;
}

/**
 * 下一次运行的输出应从何处开始堆叠。
 *
 * `spawnOutput` 会相对源节点放置新节点，因此若不加偏移，第二次运行会落在第一次的同一坐标并将其遮住。
 * 统计配置节点已有的下游，可让每次新运行排在上次下方；删除输出后，下次运行会自动回到顶部。
 */
function stackBase(nodeId: string, edges: CanvasEdge[]): number {
  return edges.filter((edge) => edge.source === nodeId).length;
}

/** 报告任务在拥有可承载错误的独立节点之前发生的失败。 */
function failConfigNode(nodeId: string, error: string): void {
  useCanvasStore.getState().setExecution(nodeId, {
    runId: newRunId(),
    status: "failed",
    error,
    finishedAt: Date.now(),
  });
}

/**
 * 在此次运行创建的节点上报告请求失败。
 *
 * 错误应显示在用户正在关注的位置，也就是本应承载图片的框，而不是上游配置节点。
 * 当两个任务同时运行时，配置节点甚至无法说明究竟是哪一个失败。
 *
 * 一次请求对应整个运行，因此只报告一次。首个节点保留错误，其余占位节点删除，
 * 避免一次拒绝请求产生四个内容相同的红色错误框。
 *
 * 只有任务完全没有创建节点时，才退回配置节点显示错误。
 */
function reportRunFailure(placeholders: string[], configNodeId: string, error: string): void {
  const store = useCanvasStore.getState();

  const [keep, ...spares] = placeholders.filter((id) =>
    store.nodes.some((candidate) => candidate.id === id),
  );

  if (!keep) {
    failConfigNode(configNodeId, error);
    return;
  }

  store.patchExecution(keep, "failed", { error });
  discardPlaceholders(spares);
}

/**
 * 重新运行节点背后的生成任务，并移除失败节点。
 *
 * 由失败或中断节点上的“重试”按钮触发。任务从向该节点供给内容的生成节点重新开始，
 * 因此重试会使用当前设置，而不是之前记住的副本；用户点击前可能已经修改了配置。
 */
export async function retryRun(
  nodeId: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): Promise<void> {
  // 新图片任务必须通过专门的查询、下载或带付费确认的重新生成入口恢复。
  if ((nodes.find((node) => node.id === nodeId)?.data as { imageJob?: unknown })?.imageJob) return;
  const config = edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => nodes.find((candidate) => candidate.id === edge.source))
    .find((candidate) => candidate?.type === "imageGen" || candidate?.type === "videoGen");

  if (!config) return;

  // 先删除旧节点，使替代节点占据它在堆叠中的位置，而不是落在一个即将移除的节点下方。
  useCanvasStore.getState().removeNodes([nodeId], { history: false });

  const { nodes: fresh, edges: freshEdges } = useCanvasStore.getState();

  if (config.type === "imageGen") {
    await runImageNode(config.id, fresh, freshEdges);
  } else {
    await runVideoNode(config.id, fresh, freshEdges);
  }
}

export async function runImageNode(
  nodeId: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): Promise<void> {
  const store = useCanvasStore.getState();
  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return;
  const data = node.data as ImageGenNodeData;
  if (!data.providerId || !data.modelId) return;
  store.setExecution(nodeId, undefined);
  const { prompt, images, maskUrl } = collectUpstream(nodeId, nodes, edges);
  if (!prompt && images.length === 0) {
    failConfigNode(nodeId, "Connect a text or image node first.");
    return;
  }
  const modelKey = resolveModelKey(data.providerId, data.modelId);
  if (!modelKey) {
    failConfigNode(nodeId, "The selected model is unavailable or disabled.");
    return;
  }
  await startImageJob(
    nodeId,
    {
      canvasId: store.canvasId,
      nodeId,
      providerId: data.providerId,
      modelKey,
      prompt,
      images: images.map((image) => image.url),
      maskUrl,
      size: data.size ?? (data.aspect ? ASPECT_TO_SIZE[data.aspect] : undefined),
      quality: data.quality === "auto" ? undefined : data.quality,
      outputFormat: data.outputFormat ?? DEFAULT_IMAGE_OUTPUT_FORMAT,
      count: Math.min(4, Math.max(1, data.count ?? 1)),
      seed: data.seed,
    },
    data.modelId,
  );
}

/** 视频任务轮询间隔。生成通常持续数分钟，频繁轮询没有意义。 */
const VIDEO_POLL_INTERVAL_MS = 4000;
/** 约 20 分钟后放弃，防止无人处理的任务被永久轮询。 */
const VIDEO_POLL_LIMIT = 300;

export async function runVideoNode(
  nodeId: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): Promise<void> {
  const store = useCanvasStore.getState();
  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return;

  const data = node.data as VideoGenNodeData;
  if (!data.providerId || !data.modelId) return;

  const duration = resolveVideoDuration(data.duration);
  if (duration === null) {
    failConfigNode(nodeId, "Duration must be a whole number from 1 to 15 seconds.");
    return;
  }

  store.setExecution(nodeId, undefined);

  const { prompt, images } = collectUpstream(nodeId, nodes, edges);

  if (!prompt && images.length === 0) {
    failConfigNode(nodeId, "Connect a text or image node first.");
    return;
  }

  const modelKey = resolveModelKey(data.providerId, data.modelId);
  if (!modelKey) {
    failConfigNode(nodeId, "The selected model is unavailable or disabled.");
    return;
  }

  const runId = newRunId();

  // 输出节点在发送请求前创建，而不是等任务被接受后再创建。若等待提供商响应，画布会长时间毫无变化，
  // 用户此时最难确认操作是否生效。节点稍后会取得任务 ID，以便页面重载后恢复轮询，
  // 而不会丢失仍在服务端渲染的视频。
  const outputId = store.spawnOutput(
    nodeId,
    "video",
    {
      prompt,
      providerId: data.providerId,
      modelId: data.modelId,
      execution: { runId, status: "running", startedAt: Date.now() },
    },
    stackBase(nodeId, edges),
  );

  // 注册控制器，使“停止”可中止任务接受请求本身。提供商接收任务后，控制器便不再有用，
  // 此后的取消操作需要对任务 ID 发送 DELETE，因此 POST 结束后立即移除控制器，
  // 无需在整个轮询期间保留。
  const controller = new AbortController();
  inFlight.set(runId, controller);

  let accepted: { jobId: string } | null = null;

  try {
    accepted = await postJson<{ jobId: string }>(
      "/api/v1/ai/videos",
      {
        canvasId: store.canvasId,
        nodeId,
        providerId: data.providerId,
        modelKey,
        prompt,
        images: images.map((image) => image.url),
        inputMode: data.seedanceInputMode ?? DEFAULT_SEEDANCE_INPUT_MODE,
        aspect: data.aspect,
        resolution: data.resolution,
        duration,
        fps: data.fps,
        seed: data.seed,
        watermark: data.watermark,
        generateAudio: data.generateAudio,
      },
      controller.signal,
    );
  } catch (error) {
    // 中止属于用户操作，不是失败；cancelRun 已清理占位节点。
    if (error instanceof DOMException && error.name === "AbortError") return;
    if (!runAlive(runId)) return;

    reportRunFailure(
      outputId ? [outputId] : [],
      nodeId,
      error instanceof Error ? error.message : "Generation failed",
    );
    return;
  } finally {
    inFlight.delete(runId);
  }

  if (!runAlive(runId)) return;

  // “停止”操作通过任务 ID 取消上游工作，`resumeVideoJobs` 也会在重载后根据它重新挂载轮询器。
  // 此操作不计入撤销记录，因为它不是用户编辑。
  if (outputId) {
    store.updateNodeData(outputId, { jobId: accepted.jobId }, { history: false });
  }

  await pollVideoJob(accepted.jobId, outputId, runId);
}

export async function pollVideoJob(
  jobId: string,
  outputNodeId: string | null,
  runId: string,
): Promise<void> {
  const store = useCanvasStore.getState();

  for (let attempt = 0; attempt < VIDEO_POLL_LIMIT; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));

    // 若等待期间任务已取消或节点已删除，则停止轮询。
    if (!runAlive(runId)) return;

    let status: {
      status: string;
      progress: number | null;
      assetUrl: string | null;
      error: string | null;
    };

    try {
      const response = await fetch(`/api/v1/ai/videos/${jobId}`, { credentials: "include" });

      // 任务记录已不存在，可能在其他标签页中被取消，也可能已被清理。它不会再产生结果，
      // 继续完成剩余轮询只会让提示延迟 20 分钟。
      if (response.status === 404) {
        if (outputNodeId) {
          store.patchExecution(outputNodeId, "failed", {
            error: "The video job is no longer available.",
          });
        }
        return;
      }

      if (!response.ok) continue;
      status = await response.json();
    } catch {
      // 短暂网络故障不应终止一个可能仍在运行的任务。
      continue;
    }

    if (status.status === "succeeded" && status.assetUrl) {
      if (outputNodeId) {
        // 此操作不计入撤销记录：它不是用户编辑；若将它与渲染完成时用户正在进行的编辑合并，
        // Ctrl+Z 会同时撤销两者。
        store.updateNodeData(
          outputNodeId,
          { assetUrl: status.assetUrl, execution: undefined },
          { history: false },
        );
      }
      return;
    }

    if (status.status === "failed" || status.status === "cancelled") {
      if (outputNodeId) {
        store.patchExecution(outputNodeId, "failed", {
          error: status.error ?? "Video generation failed",
        });
      }
      return;
    }

    if (status.progress !== null && outputNodeId) {
      store.patchExecution(outputNodeId, "running", { progress: status.progress });
    }
  }

  if (outputNodeId) {
    store.patchExecution(outputNodeId, "failed", {
      error: "Timed out waiting for the video job.",
    });
  }
}

/**
 * 为页面关闭后仍在运行的视频任务重新挂载轮询器。
 *
 * 当视频节点带有 `jobId` 时，`stripForStorage` 会刻意保留其 `running` 状态，因为任务仍在服务端继续。
 * 若不恢复轮询，节点重载后会一直显示加载，却永远得不到结果；恢复路径虽已设计并持久化，
 * 但此前没有真正接入。
 *
 * 画布完成水合后调用一次。
 */
export function resumeVideoJobs(nodes: CanvasNode[]): void {
  for (const node of nodes) {
    // 图片任务同样持有 jobId，不能误发到视频查询接口并把图片标成视频失败。
    if (node.type !== "video") continue;
    const data = node.data as { jobId?: string; execution?: NodeExecution };

    if (!data.jobId || data.execution?.status !== "running") continue;

    void pollVideoJob(data.jobId, node.id, data.execution.runId);
  }
}
