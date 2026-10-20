import type { CanvasEdge, CanvasNode } from "@/features/canvas/store";
import type { ImageNodeData, NodeKind, TextNodeData } from "@/features/canvas/types";

/**
 * 通过反向遍历边收集生成节点输入。
 *
 * 此处没有数据流引擎：运行开始时才拉取所需内容。文本节点提供文本，图片节点提供素材，
 * 生成节点则是透明的；遍历会继续穿过它们，使串联两次生成时传递原始提示词，
 * 而不是停在中间配置节点。
 *
 * 从 OpenCowork 的 `collectUpstreamText` 和 `collectUpstreamImages` 移植，并显式加入环路保护：
 * 画布允许环路，没有机制阻止用户把输出接回输入，因此无保护的深度优先搜索会挂起标签页。
 */

export interface UpstreamInputs {
  /** 按遍历顺序排列并用空行连接的上游文本。 */
  prompt: string;
  /** 参考图，最近的排在前面。 */
  images: Array<{ url: string; mediaType?: string }>;
  /** 上游存在已标记图片时使用的专用 PNG 局部重绘蒙版。 */
  maskUrl?: string;
}

const GENERATION_KINDS = new Set<NodeKind>(["imageGen", "videoGen"]);

/** 从目标到来源的邻接关系，每次遍历只构建一次。 */
function buildIncoming(edges: CanvasEdge[]): Map<string, string[]> {
  const incoming = new Map<string, string[]>();

  for (const edge of edges) {
    const sources = incoming.get(edge.target);
    if (sources) {
      sources.push(edge.source);
    } else {
      incoming.set(edge.target, [edge.source]);
    }
  }

  return incoming;
}

export function collectUpstream(
  nodeId: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): UpstreamInputs {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const incoming = buildIncoming(edges);

  const texts: string[] = [];
  const images: Array<{ url: string; mediaType?: string }> = [];
  let maskUrl: string | undefined;
  const visited = new Set<string>([nodeId]);

  // 使用迭代而非递归：长链否则会有栈溢出风险，显式栈也让已访问集合保护更清晰。
  const stack = [...(incoming.get(nodeId) ?? [])];

  while (stack.length > 0) {
    const currentId = stack.shift()!;

    // 防止环路，也防止菱形结构重复读取同一节点。
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const node = byId.get(currentId);
    if (!node) continue;

    const kind = (node.type ?? "text") as NodeKind;

    if (kind === "text") {
      const text = (node.data as TextNodeData).text?.trim();
      if (text) texts.push(text);
    } else if (kind === "image") {
      const data = node.data as ImageNodeData;
      if (data.assetUrl && data.role === "inpaint-mask") {
        maskUrl ??= data.assetUrl;
      } else if (data.assetUrl) {
        images.push({ url: data.assetUrl, mediaType: data.mediaType });
      }
      // 没有自身文本的图片会提供生成它的提示词，因此把结果重新作为参考输入时仍保留描述。
      if (data.prompt?.trim() && !data.assetUrl) {
        texts.push(data.prompt.trim());
      }
    }

    // 生成节点自身不携带内容，但也不是阻断点；遍历会穿过它们，
    // 使生成链仍能看到原始提示词。
    if (kind === "text" || GENERATION_KINDS.has(kind)) {
      stack.push(...(incoming.get(currentId) ?? []));
    }
  }

  return { prompt: texts.join("\n\n"), images, maskUrl };
}

/**
 * 报告连接来源到目标是否会形成环路。
 *
 * @xyflow/react 不阻止环路；虽然 `collectUpstream` 能容忍环路，但图连接回自身通常是误拖。
 * 在连接时拒绝，比静默生成截断提示词更清晰。
 */
export function wouldCreateCycle(source: string, target: string, edges: CanvasEdge[]): boolean {
  if (source === target) return true;

  // 当 `source` 已可从 `target` 向下游到达时，新边恰好会闭合环路。
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = outgoing.get(edge.source);
    if (targets) {
      targets.push(edge.target);
    } else {
      outgoing.set(edge.source, [edge.target]);
    }
  }

  const visited = new Set<string>();
  const stack = [target];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === source) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    stack.push(...(outgoing.get(current) ?? []));
  }

  return false;
}
