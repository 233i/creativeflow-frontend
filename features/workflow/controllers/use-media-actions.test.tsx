import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaActions } from "./use-media-actions";
import { useMediaDraft } from "./use-media-draft";
import { useMediaPartialRerun } from "./use-media-partial-rerun";
import { controllerFixture, deferred } from "./controller-test-helpers";
import { useWorkflowStore } from "../store";
import { createStarterWorkflow } from "../template";
import type { WorkflowDocument } from "../api";
import type { WorkflowRun } from "../types";
import type { WorkflowEditorDocument, WorkflowEditorSource } from "./editor-types";

vi.mock("@/components/providers/i18n-provider", () => {
  const t = (key: string) => key;
  return { useT: () => t };
});
beforeEach(() => {
  useWorkflowStore.getState().reset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

function setup(status?: WorkflowRun["status"]) {
  const fixture = controllerFixture(createStarterWorkflow());
  const initial = status ? { ...fixture.run, status } : null;
  useWorkflowStore.getState().load(fixture.graph);
  useWorkflowStore.getState().setRun(initial);
  const source: WorkflowEditorSource = { kind: "workflow", id: fixture.document.id };
  const refresh = vi.fn();
  const view = renderHook(() => {
    const [document, setDocument] = useState<WorkflowEditorDocument | null>(fixture.document);
    const [error, setError] = useState<string | null>(null);
    const [executionWorkflowId, setExecutionWorkflowId] = useState<string | null>(source.id);
    const hydratedRef = useRef(true);
    const session = {
      document,
      setDocument,
      error,
      setError,
      executionWorkflowId,
      setExecutionWorkflowId,
      hydratedRef,
      loading: false,
      v2Document: null,
    };
    const run = useWorkflowStore((state) => state.run);
    const runs = {
      run,
      active: run?.status === "running" || run?.status === "queued",
      setRun: useWorkflowStore.getState().setRun,
      refresh,
      refreshAfterMutation: refresh,
    };
    const draft = useMediaDraft(source, fixture.client, session);
    const partial = useMediaPartialRerun(source.id, fixture.client, run);
    const actions = useMediaActions({
      source,
      client: fixture.client,
      session,
      draft,
      runs,
      partial,
      videoExtensionSupported: false,
    });
    return { actions, draft, error, run, partial };
  });
  return { ...fixture, ...view, refresh };
}

describe("media execution commands", () => {
  it("rejects invalid inputs before saving or creating a run", async () => {
    const { result, graph, client } = setup();
    act(() => useWorkflowStore.getState().updateNodeData(graph.nodes[0].id, { text: "" }));
    await act(async () => {
      await result.current.actions.execute();
    });
    expect(result.current.actions.issues.length).toBeGreaterThan(0);
    expect(client.saveWorkflow).not.toHaveBeenCalled();
    expect(client.startWorkflowRun).not.toHaveBeenCalled();
  });
  it("blocks execution after save failure and preserves editable data", async () => {
    const { result, graph, client } = setup();
    client.saveWorkflow.mockRejectedValue(new Error("offline save"));
    act(() => useWorkflowStore.getState().updateNodeData(graph.nodes[0].id, { text: "retained" }));
    await act(async () => {
      await result.current.actions.execute();
    });
    expect(client.startWorkflowRun).not.toHaveBeenCalled();
    expect(result.current.draft.dirty).toBe(true);
    expect(result.current.error).toBe("offline save");
    expect(useWorkflowStore.getState().nodes[0].data.text).toBe("retained");
  });
  it("locks two triggers in one event turn, before React renders disabled controls", async () => {
    const { result, document, client } = setup();
    const save = deferred<WorkflowDocument>();
    client.saveWorkflow.mockReturnValueOnce(save.promise);
    act(() => {
      void result.current.actions.execute();
      void result.current.actions.execute();
    });
    await act(async () => {});
    expect(client.saveWorkflow).toHaveBeenCalledTimes(1);
    await act(async () => save.resolve(document));
    expect(client.startWorkflowRun).toHaveBeenCalledTimes(1);
    expect(result.current.actions.state.status).toBe("idle");
  });
  it("queries a lost creation response without another save or POST", async () => {
    const { result, client, run } = setup();
    client.startWorkflowRun.mockRejectedValue(new Error("lost response"));
    client.getLatestWorkflowRun.mockResolvedValue(null);
    await act(async () => {
      await result.current.actions.execute();
    });
    expect(result.current.actions.state.status).toBe("uncertain");
    await act(async () => {
      await result.current.actions.execute();
    });
    expect(client.startWorkflowRun).toHaveBeenCalledTimes(1);
    expect(client.saveWorkflow).toHaveBeenCalledTimes(1);
    expect(client.getLatestWorkflowRun).toHaveBeenCalledTimes(2);
    client.getLatestWorkflowRun.mockResolvedValue(run);
    await act(async () => {
      await result.current.actions.execute();
    });
    expect(result.current.run?.id).toBe(run.id);
  });
  it("reports failed cancellation and only reads the same run after an accepted cancellation", async () => {
    const { result, client, refresh } = setup("running");
    client.cancelWorkflowRun.mockRejectedValueOnce(new Error("cancel failed"));
    await act(async () => {
      await result.current.actions.cancel();
    });
    expect(result.current.error).toBe("cancel failed");
    expect(refresh).not.toHaveBeenCalled();
    expect(result.current.run?.status).toBe("running");
    await act(async () => {
      await result.current.actions.cancel();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(client.startWorkflowRun).not.toHaveBeenCalled();
  });
  it("resumes the failed run without saving edited graph data", async () => {
    const { result, client, run } = setup("failed");
    await act(async () => {
      await result.current.actions.resume();
    });
    expect(client.resumeWorkflowRun).toHaveBeenCalledExactlyOnceWith("workflow", run.id);
    expect(client.saveWorkflow).not.toHaveBeenCalled();
    expect(client.startWorkflowRun).not.toHaveBeenCalled();
    expect(result.current.run?.id).toBe("resumed");
  });
  it("does not submit when a document closes while its required save is pending", async () => {
    const { result, client, document, unmount } = setup();
    const save = deferred<WorkflowDocument>();
    client.saveWorkflow.mockReturnValueOnce(save.promise);
    act(() => {
      void result.current.actions.execute();
    });
    await act(async () => {});
    unmount();
    await act(async () => save.resolve(document));
    expect(client.startWorkflowRun).not.toHaveBeenCalled();
  });
});
