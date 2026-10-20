import { describe, expect, it } from "vitest";
import type { WorkflowExternalInputBinding } from "@/features/workflow/types";
import { buildWorkflowCurl, buildWorkflowStreamCurl } from "./call-example";

function binding(
  overrides: Partial<WorkflowExternalInputBinding> = {},
): WorkflowExternalInputBinding {
  return {
    key: "value",
    label: "Value",
    description: "",
    type: "integer",
    required: true,
    target: { nodeId: "node", field: "duration" },
    ...overrides,
  };
}

function body(input: WorkflowExternalInputBinding) {
  const curl = buildWorkflowCurl("workflow-id", [input]);
  const json = curl.slice(curl.indexOf("  -d '") + 6, -1).replaceAll("'\\''", "'");
  return JSON.parse(json).inputs.value;
}

describe("workflow API call examples", () => {
  it("opts into streaming explicitly and gives a non-buffered resume example", () => {
    expect(buildWorkflowCurl("workflow-id", [], true)).toContain('"stream": true');
    expect(buildWorkflowCurl("workflow-id", [])).not.toContain('"stream"');
    expect(buildWorkflowStreamCurl()).toContain("curl -N");
    expect(buildWorkflowStreamCurl()).toContain("/events");
    expect(buildWorkflowStreamCurl()).toContain("Last-Event-ID");
  });
  it.each([
    [{ minimum: 4, maximum: 15 }, 4],
    [{ maximum: 0 }, 0],
    [{ minimum: -10, maximum: -2 }, -2],
    [{ minimum: 1, maximum: 4 }, 1],
  ])("keeps integers inside %j", (constraints, expected) => {
    expect(body(binding({ constraints }))).toBe(expected);
  });

  it("uses defaults, including zero and false, before generating values", () => {
    expect(body(binding({ default: 8, constraints: { minimum: 4, maximum: 15 } }))).toBe(8);
    expect(body(binding({ default: 0 }))).toBe(0);
    expect(body(binding({ type: "boolean", default: false }))).toBe(false);
    expect(body(binding({ type: "string", default: "O'Reilly's image" }))).toBe("O'Reilly's image");
    expect(
      buildWorkflowCurl("workflow-id", [binding({ type: "string", default: "O'Reilly" })]),
    ).toContain("O'\\''Reilly");
  });

  it("respects enum choices and string limits and keeps image upload instructions", () => {
    expect(body(binding({ type: "enum", constraints: { values: ["720p", "1080p"] } }))).toBe(
      "720p",
    );
    expect(body(binding({ type: "string", constraints: { maxLength: 2 } }))).toHaveLength(2);
    expect(body(binding({ type: "image" }))).toEqual({
      assetId: expect.stringContaining("上传接口"),
    });
  });
});
