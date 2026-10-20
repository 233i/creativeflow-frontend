import type { WorkflowGraph } from "@/features/workflow/types";
import { newClientId } from "@/lib/client-id";

export function createStarterWorkflow(): WorkflowGraph {
  const promptId = newClientId();
  const generationId = newClientId();
  const outputId = newClientId();

  return {
    nodes: [
      {
        id: promptId,
        type: "text",
        position: { x: 80, y: 180 },
        width: 280,
        height: 180,
        data: { text: "一座云海中的未来城市，电影感光影" },
      },
      {
        id: generationId,
        type: "imageGenerate",
        position: { x: 440, y: 160 },
        width: 280,
        height: 230,
        data: { aspect: "1:1", count: 1 },
      },
      {
        id: outputId,
        type: "imageOutput",
        position: { x: 800, y: 135 },
        width: 340,
        height: 280,
        data: {},
      },
    ],
    edges: [
      {
        id: newClientId(),
        source: promptId,
        sourceHandle: "text",
        target: generationId,
        targetHandle: "prompt",
      },
      {
        id: newClientId(),
        source: generationId,
        sourceHandle: "image",
        target: outputId,
        targetHandle: "image",
      },
    ],
  };
}
