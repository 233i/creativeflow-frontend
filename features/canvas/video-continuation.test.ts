import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiProvider } from "@/features/ai/types";
import { useAiStore } from "@/features/ai/store";
import { useCanvasStore } from "@/features/canvas/store";
import type { VideoNodeData } from "@/features/canvas/types";
import { createVideoLastFrameBranch } from "@/features/canvas/video-continuation";

const VIDEO_ASSET_ID = "0191c30e-70af-7000-8000-000000000001";
const FRAME_ASSET_ID = "0191c30e-70af-7000-8000-000000000002";

function provider(type: AiProvider["type"]): AiProvider {
  return {
    id: "provider-1",
    name: "Video provider",
    type,
    baseUrl: "https://example.test",
    enabled: true,
    hasApiKey: true,
    models: [
      {
        id: "model-1",
        modelKey: "video-model",
        name: "Video model",
        enabled: true,
        category: "video",
        type,
      },
    ],
    sortOrder: 0,
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
  };
}

beforeEach(() => {
  useCanvasStore.getState().reset();
  useAiStore.setState({ providers: [provider("seedance-video")] });
});

afterEach(() => {
  vi.unstubAllGlobals();
  useAiStore.setState({ providers: [] });
});

describe("video last-frame continuation", () => {
  it.each(["seedance-video", "minimax-h3"] as const)(
    "prepares a %s first-frame generation branch",
    async (protocol) => {
      useAiStore.setState({ providers: [provider(protocol)] });
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            url: `/api/v1/canvas/assets/${FRAME_ASSET_ID}`,
            mediaType: "image/png",
            assetId: FRAME_ASSET_ID,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = useCanvasStore.getState();
      const sourceId = store.addNode(
        "videoGen",
        { x: 0, y: 0 },
        {
          providerId: "provider-1",
          modelId: "model-1",
          aspect: "16:9",
          resolution: "720p",
          duration: 5,
        },
      );
      const videoId = store.spawnOutput(sourceId, "video", {
        assetUrl: `/api/v1/canvas/assets/${VIDEO_ASSET_ID}`,
        mediaType: "video/mp4",
        providerId: "provider-1",
        modelId: "model-1",
      })!;
      const snapshot = useCanvasStore.getState();
      const video = snapshot.nodes.find((node) => node.id === videoId)!.data as VideoNodeData;

      const result = await createVideoLastFrameBranch(
        videoId,
        video,
        snapshot.nodes,
        snapshot.edges,
        true,
      );

      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/canvas/assets/${VIDEO_ASSET_ID}/last-frame`,
        expect.objectContaining({ method: "POST", credentials: "include" }),
      );
      expect(result.imageNodeId).not.toBeNull();
      expect(result.generationNodeId).not.toBeNull();

      const state = useCanvasStore.getState();
      const videoAfter = state.nodes.find((node) => node.id === videoId)!.data as VideoNodeData;
      expect(videoAfter.lastFrameUrl).toBe(`/api/v1/canvas/assets/${FRAME_ASSET_ID}`);

      const image = state.nodes.find((node) => node.id === result.imageNodeId)!;
      expect(image).toMatchObject({
        type: "image",
        data: {
          assetUrl: `/api/v1/canvas/assets/${FRAME_ASSET_ID}`,
          mediaType: "image/png",
        },
      });

      const generation = state.nodes.find((node) => node.id === result.generationNodeId)!;
      expect(generation).toMatchObject({
        type: "videoGen",
        data: {
          providerId: "provider-1",
          modelId: "model-1",
          aspect: "16:9",
          resolution: "720p",
          duration: 5,
          seedanceInputMode: "first-last",
        },
      });
      expect(state.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source: videoId, target: result.imageNodeId }),
          expect.objectContaining({ source: result.imageNodeId, target: result.generationNodeId }),
        ]),
      );
    },
  );

  it("does not request extraction again when the result card already has a cached frame", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const store = useCanvasStore.getState();
    const videoId = store.addNode(
      "video",
      { x: 0, y: 0 },
      {
        assetUrl: `/api/v1/canvas/assets/${VIDEO_ASSET_ID}`,
        lastFrameUrl: `/api/v1/canvas/assets/${FRAME_ASSET_ID}`,
        lastFrameMediaType: "image/png",
      },
    );
    const snapshot = useCanvasStore.getState();

    const result = await createVideoLastFrameBranch(
      videoId,
      snapshot.nodes[0].data as VideoNodeData,
      snapshot.nodes,
      snapshot.edges,
      false,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.imageNodeId).not.toBeNull();
    expect(result.generationNodeId).toBeNull();
  });
});
