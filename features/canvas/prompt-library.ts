/**
 * 精选提示词片段。
 *
 * 这些是修饰语而非完整提示词：用户提供主体，素材库提供图片模型真正会响应的词汇。
 * 因此每个条目会追加到现有文本，而不是替换文本。
 *
 * 保持为不了解界面的纯数据，使同一列表未来可支持选择器、命令面板或自动补全。
 */

export type PromptCategory = "style" | "lighting" | "composition" | "quality" | "medium";

export interface PromptEntry {
  id: string;
  category: PromptCategory;
  /** 在选择器中显示。 */
  label: string;
  /** 追加到提示词。使用英文，因为模型主要以英文训练。 */
  text: string;
}

export const PROMPT_CATEGORY_LABELS: Record<PromptCategory, { zh: string; en: string }> = {
  style: { zh: "风格", en: "Style" },
  lighting: { zh: "光线", en: "Lighting" },
  composition: { zh: "构图", en: "Composition" },
  medium: { zh: "媒介", en: "Medium" },
  quality: { zh: "质感", en: "Quality" },
};

export const PROMPT_LIBRARY: readonly PromptEntry[] = [
  // 风格
  {
    id: "cinematic",
    category: "style",
    label: "电影感",
    text: "cinematic, film still, anamorphic",
  },
  {
    id: "documentary",
    category: "style",
    label: "纪实",
    text: "documentary photography, candid, unposed",
  },
  {
    id: "minimal",
    category: "style",
    label: "极简",
    text: "minimalist, negative space, restrained palette",
  },
  {
    id: "retro-film",
    category: "style",
    label: "胶片",
    text: "35mm film, Kodak Portra 400, subtle grain",
  },
  {
    id: "ukiyoe",
    category: "style",
    label: "浮世绘",
    text: "ukiyo-e woodblock print, flat colour, bold outlines",
  },
  {
    id: "isometric",
    category: "style",
    label: "等距",
    text: "isometric view, clean vector shapes",
  },

  // 光线
  {
    id: "golden-hour",
    category: "lighting",
    label: "黄金时刻",
    text: "golden hour, warm rim light, long shadows",
  },
  {
    id: "overcast",
    category: "lighting",
    label: "阴天",
    text: "soft overcast light, no harsh shadows",
  },
  {
    id: "rembrandt",
    category: "lighting",
    label: "伦勃朗光",
    text: "Rembrandt lighting, single key light, deep falloff",
  },
  {
    id: "neon",
    category: "lighting",
    label: "霓虹",
    text: "neon signage, wet reflective ground, night",
  },
  {
    id: "backlit",
    category: "lighting",
    label: "逆光",
    text: "backlit, silhouette, glowing edges",
  },

  // 构图
  { id: "wide", category: "composition", label: "广角", text: "wide establishing shot, 24mm" },
  {
    id: "closeup",
    category: "composition",
    label: "特写",
    text: "tight close-up, shallow depth of field, 85mm",
  },
  { id: "topdown", category: "composition", label: "俯视", text: "top-down flat lay, centred" },
  {
    id: "rule-of-thirds",
    category: "composition",
    label: "三分构图",
    text: "rule of thirds, subject off-centre",
  },
  {
    id: "symmetry",
    category: "composition",
    label: "对称",
    text: "perfectly symmetrical, centred composition",
  },

  // 媒介
  {
    id: "watercolour",
    category: "medium",
    label: "水彩",
    text: "watercolour on cold-press paper, visible bleed",
  },
  {
    id: "oil",
    category: "medium",
    label: "油画",
    text: "oil on canvas, visible brushwork, impasto",
  },
  {
    id: "ink",
    category: "medium",
    label: "水墨",
    text: "ink wash painting, monochrome, rice paper",
  },
  {
    id: "3d-render",
    category: "medium",
    label: "三维渲染",
    text: "3D render, soft global illumination, subsurface scattering",
  },
  {
    id: "pencil",
    category: "medium",
    label: "铅笔",
    text: "graphite pencil sketch, cross-hatching",
  },

  // 质量
  { id: "detailed", category: "quality", label: "高细节", text: "highly detailed, sharp focus" },
  { id: "muted", category: "quality", label: "低饱和", text: "muted desaturated palette" },
  { id: "high-contrast", category: "quality", label: "高对比", text: "high contrast, deep blacks" },
  { id: "pastel", category: "quality", label: "柔和", text: "soft pastel tones, gentle gradients" },
];

/**
 * 将片段追加到现有提示词文本。
 *
 * 使用逗号连接，因为图片模型训练时会把逗号理解为“并且”。
 * 重复选择同一条目不会重复添加；选择器为多选保持打开，很容易双击，因此双击应无害。
 */
export function appendPrompt(current: string, addition: string): string {
  const trimmed = current.trim();
  if (!trimmed) return addition;

  const existing = trimmed
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  if (existing.includes(addition.trim().toLowerCase())) {
    return trimmed;
  }

  return `${trimmed}, ${addition}`;
}

export function promptsByCategory(): Array<[PromptCategory, PromptEntry[]]> {
  const order: PromptCategory[] = ["style", "lighting", "composition", "medium", "quality"];

  return order.map((category) => [
    category,
    PROMPT_LIBRARY.filter((entry) => entry.category === category),
  ]);
}
