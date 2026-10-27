import { act, render, screen } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { describe, expect, it } from "vitest";
import {
  WorkflowStoreProvider,
  useWorkflowStore,
  useWorkflowStoreApi,
  type createWorkflowStore,
} from "./store";
import { controllerFixture } from "./controllers/controller-test-helpers";

type Store = ReturnType<typeof createWorkflowStore>;
describe("concurrent media editor stores", () => {
  it("isolates graph imports, node changes, runs and teardown between mounted editors", () => {
    const stores = new Map<string, Store>();
    function Editor({ name }: { name: string }) {
      const api = useWorkflowStoreApi();
      const nodes = useWorkflowStore((state) => state.nodes);
      const run = useWorkflowStore((state) => state.run);
      useLayoutEffect(() => {
        stores.set(name, api);
      }, [name, api]);
      return (
        <output data-testid={name}>
          {nodes.map((node) => node.data.text).join()}|{run?.id ?? "idle"}
        </output>
      );
    }
    const view = render(
      <>
        <WorkflowStoreProvider>
          <Editor name="one" />
        </WorkflowStoreProvider>
        <WorkflowStoreProvider>
          <Editor name="two" />
        </WorkflowStoreProvider>
      </>,
    );
    act(() => {
      stores.get("one")!.getState().addNode("text", { x: 0, y: 0 });
      stores.get("two")!.getState().addNode("text", { x: 0, y: 0 });
      const first = stores.get("one")!.getState();
      first.updateNodeData(first.nodes[0].id, { text: "draft A" });
      const second = stores.get("two")!.getState();
      second.updateNodeData(second.nodes[0].id, { text: "draft B" });
      first.setRun({ ...controllerFixture().run, id: "run-A", workflowId: "A" });
      second.setRun({ ...controllerFixture().run, id: "run-B", workflowId: "B" });
    });
    expect(screen.getByTestId("one")).toHaveTextContent("draft A|run-A");
    expect(screen.getByTestId("two")).toHaveTextContent("draft B|run-B");
    act(() => stores.get("two")!.getState().load({ nodes: [], edges: [] }));
    expect(screen.getByTestId("one")).toHaveTextContent("draft A|run-A");
    view.unmount();
    expect(stores.get("one")).not.toBe(stores.get("two"));
  });
});
