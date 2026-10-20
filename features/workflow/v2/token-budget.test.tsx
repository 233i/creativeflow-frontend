import { parseWorkflowNode } from "./domain/node-validation";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAiStore } from "@/features/ai/store";
import type { AiProvider } from "@/features/ai/types";
import { importCenterWorkflow } from "@/features/admin/workflow-center/import-file";
import { V2NodeConfig } from "./node-config";
import {
  defaultData,
  snapshotGraph,
  type ModelNodeKind,
  type WorkflowV2Graph,
  type WorkflowV2NodeData,
} from "./types";

const provider: AiProvider = {
  id: "provider",
  name: "Synthetic",
  type: "openai-chat",
  baseUrl: "https://example.invalid/v1",
  enabled: true,
  hasApiKey: false,
  sortOrder: 0,
  createdAt: "",
  updatedAt: "",
  models: [
    { id: "large", modelKey: "large", name: "Large", category: "chat", enabled: true },
    {
      id: "limited",
      modelKey: "limited",
      name: "Limited",
      category: "chat",
      enabled: true,
      maxOutputTokens: 8192,
    },
  ],
};
afterEach(() => useAiStore.setState({ providers: [] }));

describe("workflow output token budget", () => {
  function setup(kind: ModelNodeKind) {
    useAiStore.setState({ providers: [provider] });
    const save = vi.fn();
    function Editor() {
      const [data, setData] = useState<WorkflowV2NodeData>({
        ...defaultData(kind),
        modelId: "large",
      });
      const graph: WorkflowV2Graph = {
        schemaVersion: 1,
        nodes: [parseWorkflowNode({ id: "model", type: kind, data, position: { x: 0, y: 0 } })],
        edges: [],
      };
      return (
        <>
          <V2NodeConfig
            node={graph.nodes[0]}
            graph={graph}
            onChange={setData}
            onBind={vi.fn()}
            onRemove={vi.fn()}
          />
          <button onClick={() => save(snapshotGraph(graph))}>保存测试图</button>
        </>
      );
    }
    render(<Editor />);
    return save;
  }

  it.each(["llm", "knowledgeAnswer", "parameterExtract", "intentClassify"] as const)(
    "preserves a large budget through %s editing and graph import",
    (kind) => {
      const save = setup(kind);
      const input = screen.getByLabelText("最大输出 token") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "32768" } });
      expect(input).toHaveValue(32768);
      expect(input.validity.valid).toBe(true);
      fireEvent.click(screen.getByText("保存测试图"));
      const graph = save.mock.calls[0][0];
      expect(graph.nodes[0].data.maxOutputTokens).toBe(32768);
      expect(
        importCenterWorkflow(
          JSON.stringify({
            format: "creativeflow-workflow",
            formatVersion: 1,
            schemaVersion: 1,
            name: "test",
            graph,
          }),
        ).ok,
      ).toBe(true);
    },
  );

  it("shows a configured model limit without silently clamping the user's saved value", () => {
    setup("knowledgeAnswer");
    const input = screen.getByLabelText("最大输出 token") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "32768" } });
    fireEvent.change(screen.getByLabelText("聊天模型"), { target: { value: "limited" } });
    expect(input).toHaveValue(32768);
    expect(input).toHaveAttribute("max", "8192");
    expect(input.validity.rangeOverflow).toBe(true);
    expect(screen.getByRole("alert")).toHaveTextContent("超过当前模型配置上限");
    fireEvent.change(screen.getByLabelText("聊天模型"), { target: { value: "large" } });
    expect(input.validity.valid).toBe(true);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    for (const value of ["0", "-1", "1.5", "2147483648"]) {
      fireEvent.change(input, { target: { value } });
      expect(input.validity.valid).toBe(false);
    }
  });
});
