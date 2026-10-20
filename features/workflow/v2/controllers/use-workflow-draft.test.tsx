import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useWorkflowDraft } from "./use-workflow-draft";
import { controllerFixture, deferred } from "../../controllers/controller-test-helpers";
import type { WorkflowDocument } from "../../api";

describe("manual typed workflow draft", () => {
  it("never autosaves and does not clear a newer edit when an older save finishes", async () => {
    const { document, client } = controllerFixture();
    const pending = deferred<WorkflowDocument>();
    client.saveWorkflow.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useWorkflowDraft(document, client));
    act(() => result.current.rename("first"));
    expect(client.saveWorkflow).not.toHaveBeenCalled();
    let save: Promise<boolean>;
    act(() => {
      save = result.current.save();
    });
    act(() => result.current.rename("newer"));
    await act(async () => {
      pending.resolve({ ...document, name: "first" });
      await save;
    });
    expect(result.current.dirty).toBe(true);
    expect(result.current.document.name).toBe("newer");
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.dirty).toBe(false);
  });
  it("merges batched node and edge deletion without bringing a deleted node back", () => {
    const { document, client, graph } = controllerFixture();
    const { result } = renderHook(() => useWorkflowDraft(document, client));
    act(() => {
      result.current.onNodesChange([{ id: graph.nodes[1].id, type: "remove" }]);
      result.current.onEdgesChange([{ id: graph.edges[0].id, type: "remove" }]);
    });
    expect(result.current.graph.nodes).toHaveLength(2);
    expect(result.current.graph.edges).toHaveLength(0);
    expect(result.current.dirty).toBe(true);
  });
  it("preserves dirty input after a rejected save and does not persist selection", async () => {
    const { document, client, graph } = controllerFixture();
    const { result } = renderHook(() => useWorkflowDraft(document, client));
    act(() =>
      result.current.onNodesChange([{ id: graph.nodes[1].id, type: "select", selected: true }]),
    );
    expect(result.current.dirty).toBe(false);
    act(() => result.current.rename("retained"));
    client.saveWorkflow.mockRejectedValue(new Error("offline"));
    await act(async () => {
      await expect(result.current.save()).rejects.toThrow("offline");
    });
    expect(result.current.dirty).toBe(true);
    expect(result.current.document.name).toBe("retained");
    expect(client.saveWorkflow.mock.calls[0][1].nodes[1]).not.toHaveProperty("selected");
  });
});
