import { describe, expect, it } from "vitest";
import { complexityViolations } from "./policy.mjs";

const finding = {
  file: "features/example/legacy.ts",
  rule: "complexity",
  message: "Function 'legacy' has a complexity of 18. Maximum allowed is 15.",
};
const exception = { ...finding, count: 1, reason: "Existing parser", owner: "example" };

describe("complexity regression gate", () => {
  it("allows only the documented existing diagnostic", () => {
    expect(complexityViolations([finding], [exception])).toEqual([]);
  });
  it.each([
    { findings: [{ ...finding, file: "features/example/new.ts" }] },
    { findings: [{ ...finding, message: finding.message.replace("18", "19") }] },
    { findings: [finding, finding] },
  ])("rejects a new file, a larger function, or another anonymous diagnostic", ({ findings }) => {
    expect(complexityViolations(findings, [exception])).not.toEqual([]);
  });
  it("requires removing an obsolete exception after a fix", () => {
    expect(complexityViolations([], [exception])).toEqual([expect.stringContaining("已过期")]);
  });
  it("requires a reason and owner and rejects duplicate exceptions", () => {
    expect(complexityViolations([finding], [{ ...exception, reason: "" }])).not.toEqual([]);
    expect(complexityViolations([finding], [exception, exception])).not.toEqual([]);
  });
});
