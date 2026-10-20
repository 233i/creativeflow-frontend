import { describe, expect, it } from "vitest";
import { isProtocolReady, PROTOCOL_SUPPORT } from "@/features/ai/protocol-support";
import {
  normalizeBaseUrl,
  PROTOCOLS_BY_CATEGORY,
  PROVIDER_TYPES,
  resolveProtocol,
} from "@/features/ai/types";

describe("protocol support matrix", () => {
  it("offers an explicit embeddings protocol without changing media resolution", () => {
    expect(PROTOCOLS_BY_CATEGORY.embedding).toEqual(["openai-embeddings"]);
    expect(
      resolveProtocol({ type: "openai-embeddings" }, { type: null, category: "embedding" }),
    ).toBe("openai-embeddings");
    expect(resolveProtocol({ type: "openai-chat" }, { type: null, category: "embedding" })).toBe(
      "openai-chat",
    );
  });
  it("covers every declared protocol", () => {
    // 新增协议若没有对应条目会读为 `undefined`，并根据使用方式静默地被视为不支持，
    // 甚至更糟地被视为支持。
    for (const protocol of PROVIDER_TYPES) {
      expect(PROTOCOL_SUPPORT[protocol]).toBeDefined();
    }
  });

  it("marks every protocol a category can resolve to", () => {
    // 节点选择器可能产生的每种协议都必须有支持状态，
    // 否则用户可能选中无法分派到任何实现的模型。
    for (const protocols of Object.values(PROTOCOLS_BY_CATEGORY)) {
      for (const protocol of protocols) {
        expect(PROTOCOL_SUPPORT[protocol]).toBeDefined();
      }
    }
  });

  it("reports readiness for a protocol that has a client", () => {
    expect(isProtocolReady("openai-images")).toBe(true);
    expect(isProtocolReady("anthropic")).toBe(true);
  });

  it("agrees with the protocol a model resolves to", () => {
    // 标记按模型的解析后协议计算，而不是按供应商协议计算，因此协议覆盖必须决定结果。
    const provider = { type: "openai-chat" } as const;

    expect(resolveProtocol(provider, { type: null, category: "image" })).toBe("openai-images");
    expect(resolveProtocol(provider, { type: "anthropic", category: "chat" })).toBe("anthropic");

    expect(isProtocolReady(resolveProtocol(provider, { type: null, category: "image" }))).toBe(
      true,
    );
  });

  it("inherits a provider protocol that already supports the media category", () => {
    expect(resolveProtocol({ type: "openai-video" }, { type: null, category: "video" })).toBe(
      "openai-video",
    );
    expect(resolveProtocol({ type: "minimax-video" }, { type: null, category: "video" })).toBe(
      "minimax-video",
    );
    expect(resolveProtocol({ type: "gemini" }, { type: null, category: "image" })).toBe("gemini");
  });

  it("only uses known support levels", () => {
    for (const level of Object.values(PROTOCOL_SUPPORT)) {
      expect(["ready", "planned"]).toContain(level);
    }
  });

  it("exposes the native H3 protocol as a video override and provider protocol", () => {
    expect(PROVIDER_TYPES).toContain("minimax-h3");
    expect(PROTOCOLS_BY_CATEGORY.video).toContain("minimax-h3");
    expect(isProtocolReady("minimax-h3")).toBe(true);
    expect(
      resolveProtocol({ type: "openai-video" }, { type: "minimax-h3", category: "video" }),
    ).toBe("minimax-h3");
    expect(resolveProtocol({ type: "minimax-h3" }, { type: null, category: "video" })).toBe(
      "minimax-h3",
    );
  });

  it.each(["", "/v1", "/v2/", "/v2/video_generation"])(
    "normalizes native H3 base URL suffix %s",
    (suffix) => {
      expect(normalizeBaseUrl(`https://api.minimax.cn${suffix}`, "minimax-h3")).toBe(
        "https://api.minimax.cn",
      );
      expect(normalizeBaseUrl("https://proxy.example/v1", "minimax-video")).toBe(
        "https://proxy.example/v1",
      );
    },
  );
});
