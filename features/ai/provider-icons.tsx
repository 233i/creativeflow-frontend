"use client";

import { Bot } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { findPreset } from "@/features/ai/presets";
import { cn } from "@/lib/utils";

/**
 * 供应商和模型徽标。
 *
 * 图标从 public/provider-icons/ 提供（由 scripts/sync-provider-icons.mjs 填充），
 * 而不是从 CDN 获取。Web 应用不应为如此小的内容在运行时依赖 unpkg，
 * 否则离线和受限网络环境也会失效。
 */

/** 将供应商 builtinId 映射到图标文件，默认使用 builtinId 本身。 */
const PROVIDER_SLUG_OVERRIDES: Record<string, string> = {
  anthropic: "claude",
  google: "gemini",
  volcengine: "doubao",
  siliconflow: "siliconcloud",
  xai: "grok",
};

/**
 * 不属于 SVG 图标包的供应商素材。
 *
 * 使用解析后的短名作为键，使模型图标采用供应商回退时得到与供应商自身相同的素材。
 */
const ICON_PATH_OVERRIDES: Record<string, string> = {
  "routin-ai": "/routin-ai.webp",
};

/**
 * 根据模型标识符推断品牌图标。
 *
 * 通过供应商 /v1/models 发现的模型不带图标元数据，因此此逻辑无需配置即可赋予正确品牌。
 * 顺序很重要：首个匹配项胜出，所以更具体的模式排在前面。
 */
const MODEL_SLUG_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/claude/i, "claude"],
  [/^(gpt|o[1-9]|chatgpt|dall-e|sora)/i, "openai"],
  [/(gemini|imagen|veo)/i, "gemini"],
  [/(seedream|seedance|doubao)/i, "doubao"],
  [/deepseek/i, "deepseek"],
  [/(qwen|qwq)/i, "qwen"],
  [/grok/i, "grok"],
  [/(glm|chatglm)/i, "zhipu"],
  [/minimax/i, "minimax"],
  [/(moonshot|kimi)/i, "moonshot"],
  [/llama/i, "meta"],
  [/mistral/i, "mistral"],
];

export function detectModelIconSlug(modelKey: string): string | null {
  for (const [pattern, slug] of MODEL_SLUG_PATTERNS) {
    if (pattern.test(modelKey)) return slug;
  }
  return null;
}

export function providerIconSlug(builtinId: string | null | undefined): string | null {
  if (!builtinId) return null;
  return PROVIDER_SLUG_OVERRIDES[builtinId] ?? findPreset(builtinId)?.iconSlug ?? builtinId;
}

interface IconProps {
  size?: number;
  className?: string;
}

function FallbackIcon({ size = 20, className }: IconProps) {
  return (
    <Bot
      className={cn("text-muted-foreground", className)}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

/**
 * 根据短名渲染图标，失败时回退到通用机器人图形。
 *
 * 短名可能过期（预设重命名或未重新运行同步脚本），损坏图片图标看起来像缺陷；
 * 因此加载错误时改用回退图标。
 */
function SlugIcon({
  slug,
  alt,
  size = 20,
  className,
}: IconProps & { slug: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!slug || failed) {
    return <FallbackIcon size={size} className={className} />;
  }

  return (
    <Image
      src={ICON_PATH_OVERRIDES[slug] ?? `/provider-icons/${slug}.svg`}
      alt={alt}
      width={size}
      height={size}
      className={cn("object-contain", className)}
      onError={() => setFailed(true)}
      unoptimized
    />
  );
}

export function ProviderIcon({
  builtinId,
  icon,
  name,
  size = 20,
  className,
}: IconProps & {
  builtinId?: string | null;
  /** 用户提供的数据 URL，优先于预设徽标。 */
  icon?: string | null;
  name?: string;
}) {
  const alt = name ?? builtinId ?? "provider";

  if (icon) {
    // 用户提供的数据 URL：next/image 无法优化，并会拒绝将其作为 src。
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={icon}
        alt={alt}
        width={size}
        height={size}
        className={cn("object-contain", className)}
      />
    );
  }

  return (
    <SlugIcon slug={providerIconSlug(builtinId)} alt={alt} size={size} className={className} />
  );
}

export function ModelIcon({
  modelKey,
  icon,
  builtinId,
  size = 16,
  className,
}: IconProps & {
  modelKey: string;
  /** 存储在模型上的显式短名，优先于推断结果。 */
  icon?: string | null;
  /** 供应商回退，在模型标识未匹配任何已知品牌时使用。 */
  builtinId?: string | null;
}) {
  const slug = icon ?? detectModelIconSlug(modelKey) ?? providerIconSlug(builtinId);
  return <SlugIcon slug={slug} alt={modelKey} size={size} className={className} />;
}
