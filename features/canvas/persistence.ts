import type { CanvasEdge, CanvasNode } from "@/features/canvas/store";
import type { ImageNodeData, NodeExecution } from "@/features/canvas/types";

/**
 * 画布持久化。
 *
 * 从 OpenCowork 延续的两条关键规则：
 *
 * 1. 保存前移除无法比文档存续更久的 URL。`data:` URL 会把数兆字节 base64 写入每次保存和撤销快照。
 *    `blob:` URL 更糟：它很小，能顺利保存，但文档卸载时立即失效；恢复后节点只会显示损坏图片，
 *    且上传入口只在完全没有图片时出现，无法恢复。两者都会被移除，使节点回到可上传的空状态。
 *
 * 2. 运行中持久化的节点恢复为 `interrupted`，而不是 `running`。拥有请求的标签页已消失，
 *    不会再有结果返回；若保持 `running`，加载动画将永不停止。视频是例外：任务按标识在服务器端继续，
 *    因此保持 `running`，并由 `resumeVideoJobs` 在加载时重新附加轮询器。
 */

export const CANVAS_SCHEMA_VERSION = 2;

const STORAGE_PREFIX = "sol.canvas.";

export interface CanvasSnapshot {
  schemaVersion: number;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  savedAt: number;
}

/**
 * 只在创建它们的文档内有效的 URL。
 *
 * 实际最关键的是 `blob:`：上传图片最初是对象 URL，若只匹配 `data:`，这些 URL 会写入存储，
 * 并在恢复时忠实地变成失效链接。在此移除还能修复已经保存为损坏状态的画布。
 */
function isEphemeralUrl(url: string | undefined): boolean {
  return typeof url === "string" && (url.startsWith("data:") || url.startsWith("blob:"));
}

/** 移除临时负载，并规范化执行中状态。 */
export function stripForStorage(nodes: CanvasNode[]): CanvasNode[] {
  return nodes.map((node) => {
    const data = { ...node.data } as ImageNodeData & { execution?: NodeExecution };

    if (isEphemeralUrl(data.assetUrl)) {
      delete data.assetUrl;
    }
    if (isEphemeralUrl((data as { posterUrl?: string }).posterUrl)) {
      delete (data as { posterUrl?: string }).posterUrl;
    }

    const execution = data.execution;
    if (execution && (execution.status === "running" || execution.status === "queued")) {
      const hasServerJob = Boolean(data.jobId || data.imageJob);

      data.execution = hasServerJob
        ? execution
        : { ...execution, status: "interrupted", finishedAt: Date.now() };
    }

    // 选区属于视图状态；恢复它会高亮用户此次从未操作的节点。
    return { ...node, data: data as CanvasNode["data"], selected: false };
  });
}

export function toSnapshot(nodes: CanvasNode[], edges: CanvasEdge[]): CanvasSnapshot {
  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    nodes: stripForStorage(nodes),
    edges,
    savedAt: Date.now(),
  };
}

export function saveLocal(canvasId: string, nodes: CanvasNode[], edges: CanvasEdge[]): void {
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${canvasId}`,
      JSON.stringify(toSnapshot(nodes, edges)),
    );
  } catch {
    // 配额已用尽，或隐私窗口禁用了存储。无法本地缓存的画布仍可工作；
    // 保存失败不值得破坏整个会话。
  }
}

export function loadLocal(canvasId: string): CanvasSnapshot | null {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${canvasId}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CanvasSnapshot>;

    // 旧架构快照会被丢弃而不是猜测解析：空画布优于节点在无提示下失去含义的画布。
    if (parsed.schemaVersion !== CANVAS_SCHEMA_VERSION) return null;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;

    return {
      schemaVersion: CANVAS_SCHEMA_VERSION,
      nodes: stripForStorage(parsed.nodes),
      edges: parsed.edges,
      savedAt: parsed.savedAt ?? 0,
    };
  } catch {
    return null;
  }
}

export function clearLocal(canvasId: string): void {
  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${canvasId}`);
  } catch {
    // 无需处理。
  }
}

/** 序列化以导出文件。使用美化格式，使导出的画布可比较差异。 */
export function exportCanvas(nodes: CanvasNode[], edges: CanvasEdge[]): string {
  return JSON.stringify(toSnapshot(nodes, edges), null, 2);
}

export type ImportResult = { ok: true; snapshot: CanvasSnapshot } | { ok: false; detail: string };

/**
 * 解析导出的画布。
 *
 * 按结构验证而不是直接信任：导入文件可能来自他人，格式错误的节点否则会在下一帧使渲染器崩溃。
 */
export function importCanvas(json: string): ImportResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, detail: "invalid JSON" };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, detail: "expected an object" };
  }

  const candidate = parsed as Partial<CanvasSnapshot>;

  if (candidate.schemaVersion !== CANVAS_SCHEMA_VERSION) {
    return { ok: false, detail: `unsupported schema version ${candidate.schemaVersion}` };
  }

  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
    return { ok: false, detail: "missing nodes or edges" };
  }

  const ids = new Set<string>();
  for (const node of candidate.nodes) {
    if (typeof node?.id !== "string" || typeof node?.type !== "string") {
      return { ok: false, detail: "a node is missing its id or type" };
    }
    if (typeof node.position?.x !== "number" || typeof node.position?.y !== "number") {
      return { ok: false, detail: `node ${node.id} has no valid position` };
    }
    if (ids.has(node.id)) {
      return { ok: false, detail: `duplicate node id ${node.id}` };
    }
    ids.add(node.id);
  }

  // 指向缺失节点的边会渲染成通往空白区域的线。
  for (const edge of candidate.edges) {
    if (!ids.has(edge?.source) || !ids.has(edge?.target)) {
      return { ok: false, detail: "an edge references a missing node" };
    }
  }

  return {
    ok: true,
    snapshot: {
      schemaVersion: CANVAS_SCHEMA_VERSION,
      nodes: stripForStorage(candidate.nodes),
      edges: candidate.edges,
      savedAt: candidate.savedAt ?? Date.now(),
    },
  };
}
