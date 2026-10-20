import { describe, expect, it } from "vitest";
import { resolveSlot, usableModelSelections } from "@/features/ai/store";
import type { AiProvider } from "@/features/ai/types";

function provider(enabled = true, modelEnabled = true): AiProvider {
  return {
    id: "provider-1",
    name: "Provider",
    type: "openai-images",
    baseUrl: "https://example.com",
    enabled,
    hasApiKey: true,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    models: [
      {
        id: "model-1",
        modelKey: "image-model",
        name: "Image model",
        enabled: modelEnabled,
        category: "image",
      },
    ],
  };
}

const slot = { providerId: "provider-1", modelId: "model-1" };

describe("resolveSlot", () => {
  it("resolves an enabled provider and model", () => {
    expect(resolveSlot([provider()], slot)?.model.id).toBe("model-1");
  });

  it("does not resolve a disabled model", () => {
    expect(resolveSlot([provider(true, false)], slot)).toBeNull();
  });

  it("does not resolve a model on a disabled provider", () => {
    expect(resolveSlot([provider(false, true)], slot)).toBeNull();
  });
});

describe("usableModelSelections", () => {
  it("returns every enabled image model while filtering disabled entries", () => {
    const first = provider();
    const second: AiProvider = {
      ...provider(),
      id: "provider-2",
      name: "Second provider",
      models: [
        {
          ...first.models[0],
          id: "model-2",
          modelKey: "second-image-model",
          name: "Second image model",
        },
        {
          ...first.models[0],
          id: "disabled-model",
          enabled: false,
          modelKey: "disabled-image-model",
        },
      ],
    };

    expect(usableModelSelections([first, second], "image").map(({ model }) => model.id)).toEqual([
      "model-1",
      "model-2",
    ]);
  });
});
