import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NodeProps } from "@xyflow/react";
import type { AiProvider } from "@/features/ai/types";
import type { WorkflowNode, WorkflowRun } from "@/features/workflow/types";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right" },
}));

vi.mock("@/components/providers/i18n-provider", () => ({
  useT: () => (key: string, values?: Record<string, string | number>) =>
    values?.index ? `${key}:${values.index}` : key,
}));

const {
  WorkflowImageOutputNode,
  WorkflowImageGenerateNode,
  WorkflowOutputNode,
  WorkflowTextNode,
  WorkflowVideoExtendNode,
  WorkflowVideoFrameNode,
  WorkflowVideoGenerateNode,
  WorkflowVideoOutputNode,
} = await import("@/features/workflow/nodes/workflow-nodes");
const { useAiStore } = await import("@/features/ai/store");
const { useWorkflowStore } = await import("@/features/workflow/store");

function runWithOutput(
  output: WorkflowRun["nodes"][number]["output"],
  nodeType: "imageOutput" | "videoOutput" | "output" = "imageOutput",
): WorkflowRun {
  return {
    id: "run-1",
    workflowId: "workflow-1",
    resumedFromRunId: null,
    status: "succeeded",
    error: null,
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:01.000Z",
    startedAt: "2026-08-18T00:00:00.000Z",
    finishedAt: "2026-08-18T00:00:01.000Z",
    nodes: [
      {
        nodeId: "output-1",
        nodeType,
        status: "succeeded",
        isReused: false,
        progress: 1,
        output,
        error: null,
        startedAt: "2026-08-18T00:00:00.000Z",
        finishedAt: "2026-08-18T00:00:01.000Z",
      },
    ],
  };
}

function outputProps(): NodeProps {
  return { id: "output-1", data: {}, selected: false } as NodeProps;
}

function renderImageOutput() {
  return render(<WorkflowImageOutputNode {...outputProps()} />);
}

function renderLegacyOutput() {
  const props = { id: "output-1", data: {}, selected: false } as NodeProps;
  return render(<WorkflowOutputNode {...props} />);
}

function renderTextNode(text = "") {
  const id = useWorkflowStore.getState().addNode("text", { x: 0, y: 0 });
  if (text) useWorkflowStore.getState().updateNodeData(id, { text });
  const node = useWorkflowStore.getState().nodes.find((candidate) => candidate.id === id)!;
  const view = render(
    <WorkflowTextNode
      {...({
        id,
        data: node.data,
        selected: false,
      } as NodeProps)}
    />,
  );

  return {
    id,
    view,
    textarea: screen.getByRole("textbox", { name: "workflow.nodeText" }) as HTMLTextAreaElement,
  };
}

beforeEach(() => {
  useWorkflowStore.getState().reset();
  useAiStore.setState({
    providers: [],
    slots: {
      chat: { providerId: null, modelId: null },
      fast: { providerId: null, modelId: null },
      image: { providerId: null, modelId: null },
      video: { providerId: null, modelId: null },
    },
  });
});

describe("workflow text input", () => {
  it("does not reconcile intermediate macOS IME text through React Flow", () => {
    const { id, textarea } = renderTextNode();
    const baselineRevision = useWorkflowStore.getState().revision;

    fireEvent.compositionStart(textarea);
    fireEvent.change(textarea, { target: { value: "ni" } });
    fireEvent.change(textarea, { target: { value: "nihao" } });

    expect(textarea.value).toBe("nihao");
    expect(useWorkflowStore.getState().nodes.find((node) => node.id === id)?.data.text).toBe("");
    expect(useWorkflowStore.getState().revision).toBe(baselineRevision);

    fireEvent.compositionEnd(textarea, { target: { value: "你好" } });

    expect(useWorkflowStore.getState().nodes.find((node) => node.id === id)?.data.text).toBe(
      "你好",
    );
    expect(useWorkflowStore.getState().revision).toBe(baselineRevision + 1);
  });

  it("still saves ordinary typing immediately", () => {
    const { id, textarea } = renderTextNode();

    fireEvent.change(textarea, { target: { value: "plain text" } });

    expect(useWorkflowStore.getState().nodes.find((node) => node.id === id)?.data.text).toBe(
      "plain text",
    );
  });

  it("accepts text replaced outside the card", () => {
    const { id, view, textarea } = renderTextNode("before");
    expect(textarea.value).toBe("before");

    view.rerender(
      <WorkflowTextNode
        {...({
          id,
          data: { text: "after" },
          selected: false,
        } as unknown as NodeProps)}
      />,
    );

    expect(screen.getByRole("textbox", { name: "workflow.nodeText" })).toHaveValue("after");
  });
});

describe("workflow image generation model selection", () => {
  function imageProvider(modelIds: string[]): AiProvider {
    return {
      id: "image-provider",
      name: "Image provider",
      type: "openai-images",
      baseUrl: "https://images.example/v1",
      enabled: true,
      hasApiKey: true,
      sortOrder: 0,
      createdAt: "",
      updatedAt: "",
      models: modelIds.map((id) => ({
        id,
        modelKey: id,
        name: `Image ${id}`,
        type: "openai-images" as const,
        category: "image" as const,
        enabled: true,
      })),
    };
  }

  function renderImageGenerate() {
    const id = useWorkflowStore.getState().addNode("imageGenerate", { x: 0, y: 0 });
    const node = useWorkflowStore.getState().nodes.find((candidate) => candidate.id === id)!;
    render(
      <WorkflowImageGenerateNode {...({ id, data: node.data, selected: false } as NodeProps)} />,
    );
    return id;
  }

  it("persists the only enabled image model as the node default", async () => {
    useAiStore.setState({ providers: [imageProvider(["image-1"])] });
    const id = renderImageGenerate();

    await waitFor(() => {
      expect(useWorkflowStore.getState().nodes.find((node) => node.id === id)?.data).toMatchObject({
        providerId: "image-provider",
        modelId: "image-1",
      });
    });
    expect(screen.getByRole("button", { name: /Image image-1/ })).toBeInTheDocument();
  });

  it("shows an active model selector when several models share one provider", () => {
    useAiStore.setState({ providers: [imageProvider(["image-1", "image-2"])] });
    renderImageGenerate();

    expect(screen.getByRole("button", { name: /node\.provider/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /node\.model/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /node\.model/ })).not.toBeDisabled();
  });
});

describe("workflow output result viewer", () => {
  it("shows a useful empty state before a run produces media", () => {
    renderImageOutput();

    expect(screen.getByText("workflow.imageOutputEmpty")).toBeInTheDocument();
    expect(screen.getByText("workflow.imageOutputHint")).toBeInTheDocument();
    expect(screen.getByText("workflow.portImageInput")).toBeInTheDocument();
    expect(screen.getByText("workflow.portImage")).toBeInTheDocument();
    expect(screen.queryByText("workflow.portVideoInput")).not.toBeInTheDocument();
  });

  it("shows one featured result with open and download actions", () => {
    useWorkflowStore.getState().setRun(runWithOutput({ images: ["/first.png"] }));
    renderImageOutput();

    expect(screen.getByAltText("workflow.resultImage")).toHaveAttribute("src", "/first.png");
    expect(screen.getByRole("link", { name: "workflow.openResult" })).toHaveAttribute(
      "href",
      "/first.png",
    );
    expect(screen.getByRole("link", { name: "common.download" })).toHaveAttribute(
      "download",
      "creativeflow-workflow-1.png",
    );
  });

  it("switches the featured result from the thumbnail strip", async () => {
    const user = userEvent.setup();
    useWorkflowStore.getState().setRun(
      runWithOutput({
        images: ["/first.png", "/second.png"],
      }),
    );
    renderImageOutput();

    await user.click(screen.getByRole("button", { name: "workflow.selectResult:2" }));

    expect(screen.getByAltText("workflow.resultImage")).toHaveAttribute("src", "/second.png");
    expect(screen.getByRole("button", { name: "workflow.selectResult:2" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("renders a dedicated video player without an image input", () => {
    useWorkflowStore.getState().setRun(runWithOutput({ videos: ["/result.mp4"] }, "videoOutput"));
    const { container } = render(<WorkflowVideoOutputNode {...outputProps()} />);

    expect(container.querySelector("video")).toHaveAttribute("src", "/result.mp4");
    expect(screen.getByText("workflow.portVideoInput")).toBeInTheDocument();
    expect(screen.queryByText("workflow.portImageInput")).not.toBeInTheDocument();
  });

  it("keeps the legacy mixed result node available for saved workflows", () => {
    useWorkflowStore.getState().setRun(
      runWithOutput(
        {
          images: ["/first.png"],
          videos: ["/result.mp4"],
        },
        "output",
      ),
    );
    renderLegacyOutput();

    expect(screen.getByText("workflow.portImage")).toBeInTheDocument();
    expect(screen.getByText("workflow.portVideo")).toBeInTheDocument();
  });
});

describe("workflow video generation", () => {
  /** 挂载真实 store 订阅，模拟 React Flow 在节点数据变化后传回新属性。 */
  function LiveVideoNode() {
    const node = useWorkflowStore((state) =>
      state.nodes.find((candidate) => candidate.id === "video"),
    )!;
    return (
      <WorkflowVideoGenerateNode
        {...({ id: node.id, data: node.data, selected: false } as NodeProps)}
      />
    );
  }

  /** 配置原生或中转 Seedance 模型及两条旧图片端口连线。 */
  function prepareSeedance(protocol: "seedance-video" | "openai-video") {
    const provider: AiProvider = {
      id: "relay",
      name: "Relay",
      type: "openai-chat",
      baseUrl: "https://relay.example/v1",
      enabled: true,
      hasApiKey: true,
      sortOrder: 0,
      createdAt: "",
      updatedAt: "",
      models: [
        {
          id: "fast",
          modelKey: "doubao-seedance-2-0-fast-260128",
          name: "Seedance 2.0 Fast",
          type: protocol,
          category: "video",
          enabled: true,
        },
      ],
    };
    useAiStore.setState({
      providers: [provider],
      slots: { ...useAiStore.getState().slots, video: { providerId: "relay", modelId: "fast" } },
    });
    useWorkflowStore.getState().load({
      nodes: [
        { id: "first", type: "image", position: { x: 0, y: 0 }, data: { assetUrl: "/first.png" } },
        { id: "last", type: "image", position: { x: 0, y: 100 }, data: { assetUrl: "/last.png" } },
        {
          id: "video",
          type: "videoGenerate",
          position: { x: 300, y: 0 },
          data: { inputMode: "reference" },
        },
      ] as WorkflowNode[],
      edges: [
        {
          id: "e1",
          source: "first",
          target: "video",
          sourceHandle: "image",
          targetHandle: "image",
        },
        { id: "e2", source: "last", target: "video", sourceHandle: "image", targetHandle: "image" },
      ],
    });
  }

  it.each(["seedance-video", "openai-video"] as const)(
    "switches and swaps Seedance frames over %s without changing connections",
    async (protocol) => {
      prepareSeedance(protocol);
      const originalEdges = useWorkflowStore.getState().edges;
      const user = userEvent.setup();
      render(<LiveVideoNode />);
      const mode = screen.getByRole("combobox", { name: "workflow.videoInputMode" });
      expect(mode).toHaveValue("reference");
      await user.selectOptions(mode, "first-last");
      expect(screen.getByText("workflow.videoFrameInput")).toBeInTheDocument();
      expect(screen.getByAltText("workflow.videoFirstFrame")).toHaveAttribute("src", "/first.png");
      expect(screen.getByAltText("workflow.videoLastFrame")).toHaveAttribute("src", "/last.png");
      await user.click(screen.getByRole("button", { name: "workflow.videoSwapFrames" }));
      expect(screen.getByAltText("workflow.videoFirstFrame")).toHaveAttribute("src", "/last.png");
      expect(screen.getByAltText("workflow.videoLastFrame")).toHaveAttribute("src", "/first.png");
      await user.selectOptions(mode, "reference");
      expect(
        screen.queryByRole("button", { name: "workflow.videoSwapFrames" }),
      ).not.toBeInTheDocument();
      expect(
        useWorkflowStore.getState().nodes.find((node) => node.id === "video")?.data.reverseFrames,
      ).toBe(true);
      expect(useWorkflowStore.getState().edges).toBe(originalEdges);
      await user.selectOptions(mode, "first-last");
      expect(screen.getByAltText("workflow.videoFirstFrame")).toHaveAttribute("src", "/last.png");
    },
  );

  it("keeps a single frame as the first frame and disables swapping", async () => {
    prepareSeedance("openai-video");
    useWorkflowStore.setState({ edges: useWorkflowStore.getState().edges.slice(0, 1) });
    render(<LiveVideoNode />);
    await userEvent
      .setup()
      .selectOptions(
        screen.getByRole("combobox", { name: "workflow.videoInputMode" }),
        "first-last",
      );
    expect(screen.getByAltText("workflow.videoFirstFrame")).toHaveAttribute("src", "/first.png");
    expect(screen.getByRole("button", { name: "workflow.videoSwapFrames" })).toBeDisabled();
    expect(screen.getByText("workflow.videoLastFrameEmpty")).toBeInTheDocument();
  });

  it("preserves an unsupported saved mode and lets the user explicitly return to reference mode", async () => {
    prepareSeedance("openai-video");
    useAiStore.setState({
      providers: useAiStore
        .getState()
        .providers.map((provider) => ({ ...provider, builtinId: "routin-ai" })),
    });
    useWorkflowStore
      .getState()
      .updateNodeData("video", { inputMode: "first-last", reverseFrames: true });
    render(<LiveVideoNode />);
    expect(screen.getByRole("alert")).toHaveTextContent("workflow.videoModeUnavailable");
    expect(screen.getByRole("option", { name: "workflow.videoInputFirstLast" })).toBeDisabled();
    await userEvent
      .setup()
      .selectOptions(
        screen.getByRole("combobox", { name: "workflow.videoInputMode" }),
        "reference",
      );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      useWorkflowStore.getState().nodes.find((node) => node.id === "video")?.data.reverseFrames,
    ).toBe(true);
  });

  it("keeps excess connected images and explains the first-last limit", async () => {
    prepareSeedance("openai-video");
    useWorkflowStore.setState({
      nodes: [
        ...useWorkflowStore.getState().nodes,
        {
          id: "extra",
          type: "image",
          position: { x: 0, y: 200 },
          data: { assetUrl: "/extra.png" },
        } as WorkflowNode,
      ],
      edges: [
        ...useWorkflowStore.getState().edges,
        {
          id: "e3",
          source: "extra",
          target: "video",
          sourceHandle: "image",
          targetHandle: "image",
        },
      ],
    });
    render(<LiveVideoNode />);
    await userEvent
      .setup()
      .selectOptions(
        screen.getByRole("combobox", { name: "workflow.videoInputMode" }),
        "first-last",
      );
    expect(screen.getByRole("alert")).toHaveTextContent("workflow.videoFramesTooMany");
    expect(screen.getByRole("button", { name: "workflow.videoSwapFrames" })).toBeDisabled();
    expect(useWorkflowStore.getState().edges).toHaveLength(3);
  });

  it("uses the native H3 model override for reference controls and official parameter limits", async () => {
    const provider = {
      id: "provider-h3",
      name: "H3 test",
      type: "openai-video",
      baseUrl: "https://provider.example/v1",
      enabled: true,
      hasApiKey: true,
      sortOrder: 0,
      createdAt: "",
      updatedAt: "",
      models: [
        {
          id: "model-h3",
          modelKey: "MiniMax-H3",
          name: "MiniMax-H3",
          enabled: true,
          category: "video",
          type: "minimax-h3",
        },
      ],
    } satisfies AiProvider;
    useAiStore.setState({
      providers: [provider],
      slots: {
        ...useAiStore.getState().slots,
        video: { providerId: provider.id, modelId: "model-h3" },
      },
    });
    const id = useWorkflowStore.getState().addNode("videoGenerate", { x: 0, y: 0 });
    const node = useWorkflowStore.getState().nodes.find((candidate) => candidate.id === id)!;
    render(
      <WorkflowVideoGenerateNode {...({ id, data: node.data, selected: false } as NodeProps)} />,
    );

    expect(screen.getByRole("spinbutton", { name: "workflow.duration" })).toHaveAttribute(
      "min",
      "4",
    );
    expect(screen.getByRole("option", { name: "768P" })).toHaveValue("720p");
    expect(screen.getByRole("option", { name: "2K" })).toHaveValue("1080p");
    expect(screen.queryByRole("option", { name: "3:2" })).not.toBeInTheDocument();
    expect(screen.queryByText("生成音频")).not.toBeInTheDocument();
    expect(screen.queryByText("随机种子")).not.toBeInTheDocument();
    const mode = screen.getByRole("combobox", { name: "workflow.videoInputMode" });
    expect(mode).toHaveValue("reference");
    await userEvent.setup().selectOptions(mode, "first-last");
    expect(
      useWorkflowStore.getState().nodes.find((candidate) => candidate.id === id)?.data.inputMode,
    ).toBe("first-last");
  });

  it("lets users select the output resolution", async () => {
    const user = userEvent.setup();
    const id = useWorkflowStore.getState().addNode("videoGenerate", { x: 0, y: 0 });
    const node = useWorkflowStore.getState().nodes.find((candidate) => candidate.id === id)!;

    render(
      <WorkflowVideoGenerateNode
        {...({
          id,
          data: node.data,
          selected: false,
        } as NodeProps)}
      />,
    );

    const resolution = screen.getByRole("combobox", { name: "workflow.resolution" });
    expect(resolution).toHaveValue("720p");

    await user.selectOptions(resolution, "1080p");

    const updated = useWorkflowStore.getState().nodes.find((candidate) => candidate.id === id)!;
    expect(updated.data.resolution).toBe("1080p");
  });

  it("limits the duration to fifteen seconds", () => {
    const id = useWorkflowStore.getState().addNode("videoGenerate", { x: 0, y: 0 });
    const node = useWorkflowStore.getState().nodes.find((candidate) => candidate.id === id)!;

    render(
      <WorkflowVideoGenerateNode
        {...({
          id,
          data: node.data,
          selected: false,
        } as NodeProps)}
      />,
    );

    const duration = screen.getByRole("spinbutton", { name: "workflow.duration" });
    expect(duration).toHaveAttribute("max", "15");

    fireEvent.change(duration, { target: { value: "16" } });

    const updated = useWorkflowStore.getState().nodes.find((candidate) => candidate.id === id)!;
    expect(updated.data.duration).toBe(5);
  });
});

describe("workflow video continuation", () => {
  it("shows the xAI extension model and its constrained duration", () => {
    const provider = {
      id: "provider-1",
      name: "Routin AI",
      type: "openai-chat",
      baseUrl: "https://api.routin.ai/v1",
      enabled: true,
      hasApiKey: true,
      sortOrder: 0,
      createdAt: "2026-08-18T00:00:00.000Z",
      updatedAt: "2026-08-18T00:00:00.000Z",
      models: [
        {
          id: "preview-model",
          modelKey: "grok-imagine-video-1.5-preview",
          name: "Grok Imagine Video 1.5 Preview",
          enabled: true,
          type: "xai-video",
          category: "video",
        },
        {
          id: "extension-model",
          modelKey: "grok-imagine-video",
          name: "Grok Imagine Video",
          enabled: true,
          type: "xai-video",
          category: "video",
        },
      ],
    } as AiProvider;
    useAiStore.setState({
      providers: [provider],
      slots: {
        ...useAiStore.getState().slots,
        video: { providerId: provider.id, modelId: "preview-model" },
      },
    });
    const id = useWorkflowStore.getState().addNode("videoExtend", { x: 0, y: 0 });
    const node = useWorkflowStore.getState().nodes.find((candidate) => candidate.id === id)!;

    render(
      <WorkflowVideoExtendNode
        {...({
          id,
          data: node.data,
          selected: false,
        } as NodeProps)}
      />,
    );

    expect(screen.getByText("workflow.nodeVideoExtend")).toBeInTheDocument();
    expect(screen.getByText("workflow.portPrompt")).toBeInTheDocument();
    expect(screen.getByText("workflow.portVideoInput")).toBeInTheDocument();
    expect(screen.getByText("Grok Imagine Video")).toBeInTheDocument();
    expect(screen.getByText("workflow.videoExtensionHint")).toBeInTheDocument();
    const duration = screen.getByRole("spinbutton", { name: "workflow.extensionDuration" });
    expect(duration).toHaveAttribute("min", "2");
    expect(duration).toHaveAttribute("max", "10");
    expect(duration).toHaveValue(6);
  });

  it("exposes a video input and an image output from the last-frame node", () => {
    const id = useWorkflowStore.getState().addNode("videoFrame", { x: 0, y: 0 });
    const node = useWorkflowStore.getState().nodes.find((candidate) => candidate.id === id)!;

    render(
      <WorkflowVideoFrameNode
        {...({
          id,
          data: node.data,
          selected: false,
        } as NodeProps)}
      />,
    );

    expect(screen.getByText("workflow.nodeVideoFrame")).toBeInTheDocument();
    expect(screen.getByText("workflow.portVideoInput")).toBeInTheDocument();
    expect(screen.getByText("workflow.portImage")).toBeInTheDocument();
    expect(screen.getByText("workflow.frameLast")).toBeInTheDocument();
    expect(screen.getByText("workflow.videoFrameHint")).toBeInTheDocument();
  });
});
