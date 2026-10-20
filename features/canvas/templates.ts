import type { TranslationKey } from "@/components/providers/i18n-provider";
import type { CanvasEdge, CanvasNode } from "@/features/canvas/store";
import { NODE_DEFAULT_SIZE, type CanvasNodeData, type NodeKind } from "@/features/canvas/types";

/** 内置已连接工作流示例的标识符。 */
export type CanvasTemplateId = "text-to-image" | "reference-to-image" | "image-to-video";

export interface CanvasTemplateNodeSpec {
  /** 只在模板内部稳定；存储会将其替换为真实画布节点标识。 */
  key: string;
  kind: NodeKind;
  position: { x: number; y: number };
  data?: Partial<CanvasNodeData>;
}

export interface CanvasTemplateEdgeSpec {
  source: string;
  target: string;
}

export interface CanvasTemplateDefinition {
  id: CanvasTemplateId;
  nameKey: TranslationKey;
  descriptionKey: TranslationKey;
  nodes: readonly CanvasTemplateNodeSpec[];
  edges: readonly CanvasTemplateEdgeSpec[];
}

/** 将模板定义转换为可作为画布文档存储的图。 */
export function instantiateCanvasTemplate(
  template: CanvasTemplateDefinition,
  createId: () => string,
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const ids = new Map(template.nodes.map((node) => [node.key, createId()]));

  return {
    nodes: template.nodes.map((node) => {
      const size = NODE_DEFAULT_SIZE[node.kind];
      return {
        id: ids.get(node.key)!,
        type: node.kind,
        position: node.position,
        data: (node.data ?? {}) as CanvasNode["data"],
        width: size.width,
        height: size.height,
      };
    }),
    edges: template.edges.map((edge) => ({
      id: createId(),
      source: ids.get(edge.source)!,
      target: ids.get(edge.target)!,
      type: "default",
    })),
  };
}

/**
 * 小型、刻意与供应商无关的工作流起始模板。
 *
 * 供应商和模型字段保持为空，使导入模板绝不会静默选择模型。图仍可立即使用：
 * 用户只需填写提示词或上传参考内容，并在生成节点选择已配置模型。
 */
export const CANVAS_TEMPLATES: readonly CanvasTemplateDefinition[] = [
  {
    id: "text-to-image",
    nameKey: "canvas.templates.textToImageName",
    descriptionKey: "canvas.templates.textToImageDescription",
    nodes: [
      { key: "prompt", kind: "text", position: { x: 0, y: 90 }, data: { text: "" } },
      {
        key: "generation",
        kind: "imageGen",
        position: { x: 380, y: 0 },
        data: { aspect: "1:1", count: 1 },
      },
    ],
    edges: [{ source: "prompt", target: "generation" }],
  },
  {
    id: "reference-to-image",
    nameKey: "canvas.templates.referenceToImageName",
    descriptionKey: "canvas.templates.referenceToImageDescription",
    nodes: [
      { key: "prompt", kind: "text", position: { x: 0, y: 0 }, data: { text: "" } },
      { key: "reference", kind: "image", position: { x: 0, y: 230 } },
      {
        key: "generation",
        kind: "imageGen",
        position: { x: 380, y: 110 },
        data: { aspect: "1:1", count: 1 },
      },
    ],
    edges: [
      { source: "prompt", target: "generation" },
      { source: "reference", target: "generation" },
    ],
  },
  {
    id: "image-to-video",
    nameKey: "canvas.templates.imageToVideoName",
    descriptionKey: "canvas.templates.imageToVideoDescription",
    nodes: [
      { key: "image", kind: "image", position: { x: 0, y: 40 } },
      {
        key: "generation",
        kind: "videoGen",
        position: { x: 380, y: 0 },
        data: { duration: 5, resolution: "720p" },
      },
    ],
    edges: [{ source: "image", target: "generation" }],
  },
];
