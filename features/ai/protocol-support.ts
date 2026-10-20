import type { McpTransport } from "@/features/ai/api";
import type { ProviderType } from "@/features/ai/types";

/**
 * 后端按协议实际支持的能力。
 *
 * “暂不支持”标记的唯一事实来源。设置界面允许用户配置任意协议，但只有部分协议有客户端实现；
 * 若无此信息，用户可能添加供应商并启用模型，直到生成时才发现没有实现可以调用。
 *
 * 当前每种协议都有客户端。保留此机制是因为列表还会增长：
 * 若协议先于客户端加入，只需把条目标记为 `"planned"`，界面无需其他修改即可显示标记。
 */
export type SupportLevel = "ready" | "planned";

export const PROTOCOL_SUPPORT: Record<ProviderType, SupportLevel> = {
  "openai-embeddings": "ready",
  rerank: "ready",
  // 图片生成。
  "openai-images": "ready",

  // 同时支持文本和图片；Gemini 通过同一端点提供两者。
  gemini: "ready",

  // 视频生成。
  "seedance-video": "ready",
  "openai-video": "ready",
  "minimax-video": "ready",
  "minimax-h3": "ready",
  "xai-video": "ready",

  // 文本生成。
  "openai-chat": "ready",
  "openai-responses": "ready",
  anthropic: "ready",
};

export function isProtocolReady(protocol: ProviderType): boolean {
  return PROTOCOL_SUPPORT[protocol] === "ready";
}

/**
 * MCP 服务器在运行时是否真正生效。
 *
 * 配置会被如实存储和返回，但当前没有实现连接服务器或调用其工具。
 * 此状态集中在这里而非内联，使客户端实现后只需修改一处即可移除 MCP 面板提示。
 */
export const MCP_RUNTIME_SUPPORTED = true;

export function isMcpRuntimeSupported(transport: McpTransport): boolean {
  return transport === "streamable-http" || transport === "sse";
}
