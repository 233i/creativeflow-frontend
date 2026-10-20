import { describe, expect, it } from "vitest";
import { createWorkflowNode } from "./node-definitions";
import { parseWorkflowNode } from "./node-validation";

function parseScript(patch: Record<string, unknown> = {}) {
  const node = createWorkflowNode("script", "script-node", { x: 0, y: 0 });
  return parseWorkflowNode({ ...node, data: { ...node.data, ...patch } });
}

describe("script node configuration validation", () => {
  it.each(["python", "javascript"])("accepts %s and the timeout boundaries", (language) => {
    for (const timeoutSeconds of [1, 30]) {
      expect(parseScript({ language, timeoutSeconds }).data).toMatchObject({
        language,
        timeoutSeconds,
      });
    }
  });

  it.each([undefined, 0, -1, 31, 1.5, NaN, Infinity, "10"])(
    "rejects invalid script timeouts: %s",
    (timeoutSeconds) => {
      expect(() => parseScript({ timeoutSeconds })).toThrow();
    },
  );

  it.each([
    ["language", { language: "shell" }],
    ["missing language", { language: undefined }],
    ["missing outputs", { outputFields: undefined }],
    ["empty code", { code: "" }],
    ["missing code", { code: undefined }],
    ["oversized code", { code: "x".repeat(32769) }],
    ["oversized UTF-8 code", { code: "汉".repeat(10923) }],
    ["NUL in code", { code: "print('\0')" }],
  ])("rejects %s", (_name, patch) => {
    expect(() => parseScript(patch)).toThrow();
  });

  it("accepts code at the byte limit without executing it", () => {
    expect(parseScript({ code: "x".repeat(32768) }).data.code).toHaveLength(32768);
  });

  it.each(["image", "contextChunks", "answer"])(
    "rejects %s fields on both script inputs and outputs",
    (type) => {
      const fields = [{ key: "value", type, required: true }];
      expect(() => parseScript({ fields })).toThrow(/脚本字段/);
      expect(() => parseScript({ outputFields: fields })).toThrow(/脚本字段/);
    },
  );

  it("does not apply script timeouts to LLM nodes", () => {
    const node = createWorkflowNode("llm", "llm-node", { x: 0, y: 0 });
    expect(parseWorkflowNode(node).data.timeoutSeconds).toBe(120);
  });
});
