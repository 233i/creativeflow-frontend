import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaDraft } from "./use-media-draft";
import { controllerFixture, deferred } from "./controller-test-helpers";
import { useWorkflowStore } from "../store";
import { createStarterWorkflow } from "../template";
import type { WorkflowDocument } from "../api";
import type { WorkflowEditorDocument, WorkflowEditorSource } from "./editor-types";

vi.mock("@/components/providers/i18n-provider", () => {
  const t = (key: string) => key;
  return { useT: () => t };
});
beforeEach(() => {
  vi.useFakeTimers();
  useWorkflowStore.getState().reset();
});
afterEach(() => vi.useRealTimers());

function setup() {
  const fixture = controllerFixture(createStarterWorkflow());
  useWorkflowStore.getState().load(fixture.graph);
  const source: WorkflowEditorSource = { kind: "workflow", id: fixture.document.id };
  const view = renderHook(() => {
    const [document, setDocument] = useState<WorkflowEditorDocument | null>(fixture.document);
    const [error, setError] = useState<string | null>(null);
    const [executionWorkflowId, setExecutionWorkflowId] = useState<string | null>(source.id);
    const hydratedRef = useRef(true);
    const draft = useMediaDraft(source, fixture.client, {
      document,
      setDocument,
      error,
      setError,
      executionWorkflowId,
      setExecutionWorkflowId,
      hydratedRef,
      loading: false,
      v2Document: null,
    });
    return { draft, document, error };
  });
  const edit = (text: string) =>
    act(() => useWorkflowStore.getState().updateNodeData(fixture.graph.nodes[0].id, { text }));
  return { ...fixture, ...view, edit };
}

describe("media draft save queue", () => {
  it("does not write on mount, and debounces edits into the latest snapshot", async () => {
    const { client, edit, result } = setup();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(client.saveWorkflow).not.toHaveBeenCalled();
    edit("first");
    await act(() => vi.advanceTimersByTimeAsync(300));
    edit("second");
    await act(() => vi.advanceTimersByTimeAsync(499));
    expect(client.saveWorkflow).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(client.saveWorkflow).toHaveBeenCalledTimes(1);
    expect(client.saveWorkflow.mock.calls[0][1].nodes[0].data.text).toBe("second");
    expect(result.current.draft.state.status).toBe("saved");
  });
  it("serializes snapshots and keeps a newer failed save dirty", async () => {
    const { client, edit, result, document } = setup();
    const first = deferred<WorkflowDocument>();
    const second = deferred<WorkflowDocument>();
    client.saveWorkflow.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    edit("first");
    let a: Promise<boolean>;
    act(() => {
      a = result.current.draft.save();
    });
    await act(async () => {});
    edit("second");
    let b: Promise<boolean>;
    act(() => {
      b = result.current.draft.save();
    });
    expect(client.saveWorkflow).toHaveBeenCalledTimes(1);
    await act(async () => {
      first.resolve(document);
      await a;
    });
    expect(client.saveWorkflow).toHaveBeenCalledTimes(2);
    expect(client.saveWorkflow.mock.calls.map((call) => call[1].nodes[0].data.text)).toEqual([
      "first",
      "second",
    ]);
    expect(result.current.draft.dirty).toBe(true);
    await act(async () => {
      second.reject(new Error("save failed"));
      await b;
    });
    expect(result.current.draft.state.status).toBe("failed");
    expect(result.current.error).toBe("save failed");
    expect(useWorkflowStore.getState().nodes[0].data.text).toBe("second");
    await act(async () => {
      await result.current.draft.save();
    });
    expect(result.current.draft.dirty).toBe(false);
  });
  it("does not start a queued write or accept an old response after unmount", async () => {
    const { client, edit, result, unmount, document } = setup();
    const first = deferred<WorkflowDocument>();
    client.saveWorkflow.mockReturnValueOnce(first.promise);
    edit("first");
    act(() => {
      void result.current.draft.save();
    });
    await act(async () => {});
    edit("second");
    act(() => {
      void result.current.draft.save();
    });
    unmount();
    await act(async () => first.resolve(document));
    expect(client.saveWorkflow).toHaveBeenCalledTimes(1);
  });
});
