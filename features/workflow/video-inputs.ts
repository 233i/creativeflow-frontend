import type { WorkflowEdge, WorkflowNode } from "@/features/workflow/types";

/** 一张工作流图片的来源；生成节点使用占位信息，不复用上次运行的图片。 */
export interface WorkflowVideoImage {
  /** 最初提供图片的节点标识。 */
  sourceId: string;
  /** 同一个来源节点中的图片序号，从 1 开始。 */
  index: number;
  /** 已上传图片的当前地址；运行时才生成的图片没有地址。 */
  url?: string;
  /** 图片是否需要等待上游节点执行后才能确定。 */
  pending: boolean;
}

/** 两张用于帧预览，第三张仅用于提示超限，避免展开整张图的所有组合。 */
const PREVIEW_LIMIT = 3;

/** 按后端的连线顺序预览视频输入；图片结果节点继续追溯其输入。 */
export function workflowVideoImages(
  nodeId: string,
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
): WorkflowVideoImage[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const cache = new Map<string, WorkflowVideoImage[]>();

  /** 仅沿图片连接展开，并在不完整草稿含循环时停止追溯。 */
  function collect(id: string, visiting: ReadonlySet<string>): WorkflowVideoImage[] {
    if (visiting.has(id)) return [];
    const cached = cache.get(id);
    if (cached) return cached;
    const next = new Set(visiting).add(id);
    const images: WorkflowVideoImage[] = [];
    for (const edge of edges) {
      if (edge.target !== id || edge.targetHandle !== "image") continue;
      const source = byId.get(edge.source);
      if (!source) continue;
      if (source.type === "image") {
        images.push({
          sourceId: source.id,
          index: 1,
          url: typeof source.data.assetUrl === "string" ? source.data.assetUrl : undefined,
          pending: false,
        });
      } else if (source.type === "imageOutput") {
        images.push(...collect(source.id, next));
      } else if (source.type === "imageGenerate" || source.type === "videoFrame") {
        const count =
          source.type === "imageGenerate" && Number.isInteger(source.data.count)
            ? Math.max(1, Math.min(PREVIEW_LIMIT, Number(source.data.count)))
            : 1;
        for (let index = 1; index <= count; index++) {
          images.push({ sourceId: source.id, index, pending: true });
        }
      }
      if (images.length >= PREVIEW_LIMIT) break;
    }
    // 结果节点可能被多条分支复用，缓存空结果同样重要，避免不完整草稿反复展开相同子图。
    const result = images.slice(0, PREVIEW_LIMIT);
    cache.set(id, result);
    return result;
  }

  return collect(nodeId, new Set());
}

/** 只在首尾帧且恰好两张图片时交换顺序；参考图模式始终保留原始连接顺序。 */
export function orderedVideoFrames<T>(
  images: readonly T[],
  inputMode: string | undefined,
  reverseFrames: boolean | undefined,
): readonly T[] {
  return inputMode === "first-last" && reverseFrames === true && images.length === 2
    ? [images[1], images[0]]
    : images;
}
