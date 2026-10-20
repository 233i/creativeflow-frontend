import { describe, expect, it } from "vitest";
import {
  buildConversationEntries,
  collectToolCalls,
  mergeDisplayBlocks,
  mergeToolCalls,
} from "@/features/agent/conversation";
import type { AgentContentBlock, AgentLiveToolCall, AgentMessage } from "@/features/agent/types";

function message(
  id: string,
  role: string,
  blocks: AgentContentBlock[],
  runId: string | null = "run-1",
): AgentMessage {
  return {
    id,
    role,
    runId,
    ordinal: 0,
    contentJson: JSON.stringify(blocks),
    createdAt: "2026-09-05T00:00:00Z",
  };
}

describe("conversation grouping", () => {
  it("groups assistant iterations within a run and hides tool-result-only messages", () => {
    const prompt = message("prompt", "user", [{ kind: "text", text: "Create an image" }]);
    const first: AgentContentBlock[] = [
      { kind: "thinking", text: "Preparing the canvas" },
      { kind: "tool_use", toolUseId: "call-1", toolName: "create_node", json: "{}" },
    ];
    const final: AgentContentBlock = { kind: "text", text: "The image is ready" };
    const nextPrompt = message(
      "next",
      "user",
      [{ kind: "text", text: "Make it brighter" }],
      "run-2",
    );
    const messages = [
      prompt,
      message("iteration-1", "assistant", first),
      message("result", "user", [{ kind: "tool_result", toolUseId: "call-1", json: "{}" }]),
      message("iteration-2", "assistant", [final]),
      nextPrompt,
    ];

    expect(buildConversationEntries(messages)).toEqual([
      { kind: "user", id: "user-run-1", message: prompt },
      { kind: "assistant", id: "assistant-run-1", runId: "run-1", blocks: [...first, final] },
      { kind: "user", id: "user-run-2", message: nextPrompt },
    ]);
  });

  it("keeps legacy assistant messages without run IDs separate", () => {
    const entries = buildConversationEntries([
      message("first", "assistant", [{ kind: "text", text: "First reply" }], null),
      message("second", "assistant", [{ kind: "text", text: "Second reply" }], null),
    ]);

    expect(entries.map((entry) => entry.id)).toEqual(["assistant-first", "assistant-second"]);
  });

  it("shows image-only user messages and tolerates malformed or empty content", () => {
    const image = message("image", "user", [{ kind: "image", imageUrl: "/asset.png" }]);

    expect(
      buildConversationEntries([
        { ...message("invalid", "user", []), contentJson: "invalid json" },
        message("empty", "user", [{ kind: "text", text: "" }]),
        image,
      ]),
    ).toEqual([{ kind: "user", id: "user-run-1", message: image }]);
  });
});

describe("persisted and live tool calls", () => {
  it("attaches results and errors to their original calls while ignoring orphan results", () => {
    const calls = collectToolCalls([
      message("calls", "assistant", [
        { kind: "tool_use", toolUseId: "first", toolName: "create_node", json: '{"type":"text"}' },
        { kind: "tool_use", toolUseId: "pending" },
      ]),
      message("results", "user", [
        { kind: "tool_result", toolUseId: "orphan", text: "ignored" },
        { kind: "tool_result", toolUseId: "first", text: "Node limit reached", isError: true },
      ]),
    ]);

    expect([...calls.values()]).toEqual([
      {
        id: "first",
        name: "create_node",
        input: '{"type":"text"}',
        result: "Node limit reached",
        isError: true,
      },
      { id: "pending", name: "tool", input: "{}", result: null, isError: false },
    ]);
  });

  it("uses live results without mutating the persisted call map", () => {
    const storedCall: AgentLiveToolCall = {
      id: "call-1",
      name: "read_canvas",
      input: "{}",
      result: null,
      isError: false,
    };
    const stored = new Map([[storedCall.id, storedCall]]);
    const completed = { ...storedCall, result: '{"nodes":[]}' };
    const liveOnly = { ...storedCall, id: "call-2", name: "create_node" };

    const merged = mergeToolCalls(stored, [completed, liveOnly]);

    expect([...merged.values()]).toEqual([completed, liveOnly]);
    expect(stored.size).toBe(1);
    expect(stored.get("call-1")?.result).toBeNull();
    expect(merged.get("call-1")).not.toBe(completed);
  });

  it("deduplicates overlapping tools and preserves the order of text and thinking blocks", () => {
    const text: AgentContentBlock = { kind: "text", text: "Creating the node" };
    const first: AgentContentBlock = {
      kind: "tool_use",
      toolUseId: "call-1",
      toolName: "create_node",
    };
    const thinking: AgentContentBlock = { kind: "thinking", text: "Checking its status" };
    const second: AgentContentBlock = {
      kind: "tool_use",
      toolUseId: "call-2",
      toolName: "get_node_status",
    };
    const final: AgentContentBlock = { kind: "text", text: "Done" };
    const stored = [text, first];
    const live = [first, thinking, second, second, final];

    expect(mergeDisplayBlocks(stored, live)).toEqual([text, first, thinking, second, final]);
    expect(stored).toEqual([text, first]);
    expect(live).toHaveLength(5);
  });
});
