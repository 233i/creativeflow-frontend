import { describe, expect, it } from "vitest";
import {
  appendPrompt,
  PROMPT_CATEGORY_LABELS,
  PROMPT_LIBRARY,
  promptsByCategory,
} from "@/features/canvas/prompt-library";

describe("appendPrompt", () => {
  it("uses the fragment alone when there is nothing yet", () => {
    expect(appendPrompt("", "golden hour")).toBe("golden hour");
    expect(appendPrompt("   ", "golden hour")).toBe("golden hour");
  });

  it("comma-joins onto existing text", () => {
    // 图片模型会把逗号理解为“并且还要”。
    expect(appendPrompt("a red barn", "golden hour")).toBe("a red barn, golden hour");
  });

  it("does not duplicate a fragment already present", () => {
    // 选择器会保持打开以支持多选，因此双击不能产生副作用。
    const once = appendPrompt("a red barn", "golden hour");
    expect(appendPrompt(once, "golden hour")).toBe(once);
  });

  it("matches an existing fragment regardless of case or padding", () => {
    expect(appendPrompt("a barn,  GOLDEN HOUR ", "golden hour")).toBe("a barn,  GOLDEN HOUR");
  });

  it("still appends a fragment that merely contains an existing one", () => {
    // 包含子串并不代表相等："wide shot" 不能阻止追加 "wide establishing shot"。
    const result = appendPrompt("wide shot", "wide establishing shot, 24mm");
    expect(result).toBe("wide shot, wide establishing shot, 24mm");
  });

  it("trims surrounding whitespace from the base text", () => {
    expect(appendPrompt("  a barn  ", "neon")).toBe("a barn, neon");
  });
});

describe("prompt library data", () => {
  it("has unique ids", () => {
    const ids = PROMPT_LIBRARY.map((entry) => entry.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("has unique insert text, so selections cannot collide", () => {
    const texts = PROMPT_LIBRARY.map((entry) => entry.text);
    expect(texts.length).toBe(new Set(texts).size);
  });

  it("labels every category it uses", () => {
    for (const entry of PROMPT_LIBRARY) {
      expect(PROMPT_CATEGORY_LABELS[entry.category]).toBeDefined();
    }
  });

  it("groups every entry exactly once", () => {
    const grouped = promptsByCategory().flatMap(([, entries]) => entries);
    expect(grouped).toHaveLength(PROMPT_LIBRARY.length);
  });

  it("inserts English text, which is what models are trained on", () => {
    // 标签会本地化，但插入的提示词片段不会。
    for (const entry of PROMPT_LIBRARY) {
      expect(entry.text).toMatch(/^[\x20-\x7E]+$/);
    }
  });
});
