import { z } from "zod";
import type { CreateMcpServerInput, McpTransport } from "@/features/ai/api";

/**
 * 解析 Claude Desktop 风格的 MCP 配置数据。
 *
 * 同时接受从 Claude Desktop 复制的 `{ "mcpServers": { … } }` 包装形式，
 * 以及同结构的裸映射，因为两种形式都常见于 README。
 */

const entrySchema = z.object({
  command: z.string().trim().min(1).optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  cwd: z.string().optional(),
  url: z.string().trim().min(1).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  transport: z.enum(["stdio", "sse", "streamable-http"]).optional(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
});

const configSchema = z.union([
  z.object({ mcpServers: z.record(z.string(), entrySchema) }),
  z.record(z.string(), entrySchema),
]);

export type McpImportResult =
  { ok: true; servers: CreateMcpServerInput[] } | { ok: false; detail: string };

/**
 * 配置未声明传输方式时进行推断。
 *
 * Claude Desktop 格式没有 `transport` 键，而是由存在的字段隐含决定。
 * `/sse` 路径是旧版 SSE 传输的惯用标记；其他 URL 均视为当前服务器使用的可流式 HTTP。
 */
function inferTransport(entry: z.infer<typeof entrySchema>): McpTransport {
  if (entry.transport) return entry.transport;
  if (!entry.url) return "stdio";
  return entry.url.includes("/sse") ? "sse" : "streamable-http";
}

export function parseMcpConfig(json: string): McpImportResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, detail: "invalid JSON" };
  }

  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, detail: result.error.issues[0]?.message ?? "schema mismatch" };
  }

  const entries =
    "mcpServers" in result.data && typeof result.data.mcpServers === "object"
      ? result.data.mcpServers
      : (result.data as Record<string, z.infer<typeof entrySchema>>);

  const servers: CreateMcpServerInput[] = [];

  for (const [name, entry] of Object.entries(entries)) {
    const transport = inferTransport(entry);

    // 服务器也会拒绝这些内容，但在此失败能指出具体问题条目；
    // 粘贴二十个服务器配置后收到通用 400 无法提供该信息。
    if (transport === "stdio" && !entry.command) {
      return { ok: false, detail: `"${name}" has no command` };
    }
    if (transport !== "stdio" && !entry.url) {
      return { ok: false, detail: `"${name}" has no url` };
    }

    servers.push({
      name,
      description: entry.description ?? null,
      transport,
      command: entry.command ?? null,
      args: entry.args ?? [],
      env: Object.entries(entry.env ?? {}).map(([key, value]) => ({ key, value: String(value) })),
      cwd: entry.cwd ?? null,
      url: entry.url ?? null,
      headers: Object.entries(entry.headers ?? {}).map(([key, value]) => ({
        key,
        value: String(value),
      })),
      autoFallback: transport === "streamable-http",
      enabled: entry.disabled !== true,
    });
  }

  if (servers.length === 0) {
    return { ok: false, detail: "no servers found" };
  }

  return { ok: true, servers };
}
