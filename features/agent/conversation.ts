import {
  parseAgentContent,
  type AgentContentBlock,
  type AgentLiveToolCall,
  type AgentMessage,
} from "@/features/agent/types";

export type ToolCallView = AgentLiveToolCall;

interface UserConversationEntry {
  kind: "user";
  id: string;
  message: AgentMessage;
}

interface AssistantConversationEntry {
  kind: "assistant";
  id: string;
  runId: string | null;
  blocks: AgentContentBlock[];
}

export type ConversationEntry = UserConversationEntry | AssistantConversationEntry;

/** 将同一轮运行的持久化助手消息按出现顺序合并，隐藏纯工具结果消息。 */
export function buildConversationEntries(messages: AgentMessage[]): ConversationEntry[] {
  const entries: ConversationEntry[] = [];
  const assistantGroups = new Map<string, AssistantConversationEntry>();

  for (const message of messages) {
    const blocks = parseAgentContent(message.contentJson);
    if (message.role === "assistant") {
      const groupId = message.runId ?? message.id;
      let group = assistantGroups.get(groupId);
      if (!group) {
        group = {
          kind: "assistant",
          id: `assistant-${groupId}`,
          runId: message.runId,
          blocks: [],
        };
        assistantGroups.set(groupId, group);
        entries.push(group);
      }
      group.blocks.push(...blocks);
      continue;
    }

    if (hasVisibleUserContent(blocks)) {
      entries.push({
        kind: "user",
        id: `user-${message.runId ?? message.id}`,
        message,
      });
    }
  }

  return entries;
}

function hasVisibleUserContent(blocks: AgentContentBlock[]): boolean {
  return blocks.some(
    (block) =>
      (block.kind === "text" && Boolean(block.text)) ||
      (block.kind === "image" && Boolean(block.imageUrl)),
  );
}

export function collectToolCalls(messages: AgentMessage[]): Map<string, ToolCallView> {
  const calls = new Map<string, ToolCallView>();
  for (const message of messages) {
    for (const block of parseAgentContent(message.contentJson)) {
      if (block.kind === "tool_use" && block.toolUseId) {
        calls.set(block.toolUseId, {
          id: block.toolUseId,
          name: block.toolName ?? "tool",
          input: block.json ?? "{}",
          result: null,
          isError: false,
        });
      } else if (block.kind === "tool_result" && block.toolUseId) {
        const call = calls.get(block.toolUseId);
        if (call) {
          call.result = block.json ?? block.text ?? "";
          call.isError = block.isError === true;
        }
      }
    }
  }
  return calls;
}

/** 持久化与实时事件重叠时，同一工具只展示一次，文本和思考块保持原有顺序。 */
export function mergeDisplayBlocks(
  stored: AgentContentBlock[],
  live: AgentContentBlock[],
): AgentContentBlock[] {
  const result = [...stored];
  const storedToolIds = new Set(
    stored
      .filter((block) => block.kind === "tool_use" && block.toolUseId)
      .map((block) => block.toolUseId),
  );

  for (const block of live) {
    if (block.kind === "tool_use" && block.toolUseId) {
      if (storedToolIds.has(block.toolUseId)) continue;
      storedToolIds.add(block.toolUseId);
    }
    result.push(block);
  }
  return result;
}

export function mergeToolCalls(
  stored: Map<string, ToolCallView>,
  live: AgentLiveToolCall[],
): Map<string, ToolCallView> {
  const calls = new Map(stored);
  for (const tool of live) {
    calls.set(tool.id, {
      id: tool.id,
      name: tool.name,
      input: tool.input,
      result: tool.result,
      isError: tool.isError,
    });
  }
  return calls;
}
