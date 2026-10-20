import { describe, expect, it } from "vitest";
import { columnWidths } from "./column-settings";

describe("个人列表列宽", () => {
  it("uses defaults for unavailable or corrupt storage", () => {
    expect(columnWidths("invalid").name).toBe(210);
    expect(columnWidths("null").actions).toBe(208);
    expect(columnWidths("[]").kind).toBe(96);
  });
  it("keeps column widths within readable bounds", () => {
    expect(columnWidths('{"name":320,"kind":-1,"source":9999,"actions":"200"}')).toMatchObject({
      name: 320,
      kind: 96,
      source: 640,
      actions: 208,
    });
  });
});
