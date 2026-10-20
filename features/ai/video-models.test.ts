import { describe, expect, it } from "vitest";
import {
  fixedVideoResolution,
  supportsVideoImageInputMode,
  usesSeedanceVideoParameters,
  videoParameterOptions,
  videoResolutionLabel,
} from "@/features/ai/video-models";

describe("fixedVideoResolution", () => {
  it.each([
    ["sd-mini-480p", "480p"],
    ["sd-fast-720p", "720p"],
    ["sd-2.0-1080p", "1080p"],
  ] as const)("reads the resolution encoded in %s", (modelKey, resolution) => {
    expect(fixedVideoResolution(modelKey)).toBe(resolution);
  });

  it("leaves other video models configurable", () => {
    expect(fixedVideoResolution("sora-2")).toBeNull();
  });
});

describe("native MiniMax H3 parameters", () => {
  it("enables reference/first-last selection without enabling Seedance-only fields", () => {
    expect(supportsVideoImageInputMode("MiniMax-H3", "minimax-h3")).toBe(true);
    expect(usesSeedanceVideoParameters("MiniMax-H3", "minimax-h3")).toBe(false);
    expect(supportsVideoImageInputMode("MiniMax-H3", "minimax-video")).toBe(false);
    expect(supportsVideoImageInputMode("sora-2", "openai-video")).toBe(false);
  });

  it("uses official duration and resolution limits while preserving saved values", () => {
    expect(videoParameterOptions("MiniMax-H3", "minimax-h3")).toEqual({
      resolutions: ["720p", "1080p"],
      durationMin: 4,
    });
    expect(videoParameterOptions("MiniMax-H3-Max", "minimax-h3")).toEqual({
      resolutions: ["480p", "720p"],
      durationMin: 5,
    });
    expect(videoResolutionLabel("720p", "minimax-h3")).toBe("768P");
    expect(videoResolutionLabel("1080p", "minimax-h3")).toBe("2K");
    expect(videoResolutionLabel("720p", "seedance-video")).toBe("720p");
  });

  it("preserves other providers' parameter options", () => {
    expect(videoParameterOptions("sd-fast-720p", "openai-video")).toEqual({
      resolutions: ["720p"],
      durationMin: 1,
    });
    expect(videoParameterOptions("grok-imagine-video", "xai-video").resolutions).toEqual([
      "480p",
      "720p",
    ]);
  });
});

describe("usesSeedanceVideoParameters", () => {
  it("exposes frame modes only for routes that actually forward image roles", () => {
    expect(supportsVideoImageInputMode("doubao-seedance-2-0-fast-260128", "openai-video")).toBe(
      true,
    );
    expect(
      supportsVideoImageInputMode("doubao-seedance-2-0-fast-260128", "openai-video", "routin-ai"),
    ).toBe(false);
    expect(
      supportsVideoImageInputMode("doubao-seedance-2-0-fast-260128", "seedance-video", "routin-ai"),
    ).toBe(true);
    expect(supportsVideoImageInputMode("custom-alias", "seedance-video")).toBe(true);
    expect(supportsVideoImageInputMode("seedance-alias", "xai-video")).toBe(false);
  });

  it("recognizes Seedance behind an OpenAI video compatibility route", () => {
    expect(usesSeedanceVideoParameters("doubao-seedance-2.0-fast", "openai-video")).toBe(true);
  });

  it("keeps explicit Seedance protocol support for aliased model keys", () => {
    expect(usesSeedanceVideoParameters("custom-video-alias", "seedance-video")).toBe(true);
  });

  it("does not apply Seedance controls to generic OpenAI video models", () => {
    expect(usesSeedanceVideoParameters("sora-2", "openai-video")).toBe(false);
  });
});
