"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { createContext, createElement, useContext, useState, type ReactNode } from "react";
import type {
  WorkflowEdge,
  WorkflowExternalApiManifest,
  WorkflowExternalBindingTarget,
  WorkflowExternalInputBinding,
  WorkflowExternalOutputBinding,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeKind,
  WorkflowRun,
  WorkflowRunChangedEvent,
} from "@/features/workflow/types";
import { WORKFLOW_NODE_SIZE } from "@/features/workflow/types";
import { newClientId } from "@/lib/client-id";

interface WorkflowState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  revision: number;
  run: WorkflowRun | null;
  externalApi: WorkflowExternalApiManifest;
  bindingTarget: WorkflowExternalBindingTarget | null;

  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  connect: (connection: Connection) => void;
  addNode: (kind: WorkflowNodeKind, position: { x: number; y: number }) => string;
  updateNodeData: (id: string, patch: Partial<WorkflowNodeData>) => void;
  openBinding: (target: WorkflowExternalBindingTarget) => void;
  closeBinding: () => void;
  saveInputBinding: (binding: WorkflowExternalInputBinding) => void;
  removeInputBinding: (nodeId: string, field: string) => void;
  saveOutputBinding: (binding: WorkflowExternalOutputBinding) => void;
  removeOutputBinding: (nodeId: string) => void;
  load: (graph: WorkflowGraph) => void;
  setRun: (run: WorkflowRun | null) => void;
  applyRunEvent: (event: WorkflowRunChangedEvent) => void;
  reset: () => void;
}

function defaultData(kind: WorkflowNodeKind): WorkflowNodeData {
  switch (kind) {
    case "text":
      return { text: "" };
    case "image":
      return {};
    case "imageGenerate":
      return { aspect: "1:1", count: 1 };
    case "videoGenerate":
      return { aspect: "16:9", resolution: "720p", duration: 5, inputMode: "reference" };
    case "videoExtend":
      return { duration: 6 };
    case "videoFrame":
      return { frame: "last" };
    default:
      return {};
  }
}

export const createWorkflowStore = () =>
  createStore<WorkflowState>((set) => ({
    nodes: [],
    edges: [],
    revision: 0,
    run: null,
    externalApi: { schemaVersion: 1, inputs: [], outputs: [] },
    bindingTarget: null,

    onNodesChange: (changes) => {
      set((state) => {
        const nodes = applyNodeChanges(changes, state.nodes);
        const nodeIds = new Set(nodes.map((node) => node.id));
        return {
          nodes,
          externalApi: {
            ...state.externalApi,
            inputs: state.externalApi.inputs.filter((input) => nodeIds.has(input.target.nodeId)),
            outputs: state.externalApi.outputs.filter((output) => nodeIds.has(output.nodeId)),
          },
          // React Flow emits measurement-only changes on every initial render. Node sizes are fixed
          // by the workflow schema, so treating those as edits causes a just-published workflow to
          // immediately appear as having unpublished changes after a page reload.
          revision: changes.some(
            (change) => change.type !== "select" && change.type !== "dimensions",
          )
            ? state.revision + 1
            : state.revision,
        };
      });
    },

    onEdgesChange: (changes) => {
      set((state) => ({
        edges: applyEdgeChanges(changes, state.edges),
        revision: changes.some((change) => change.type !== "select")
          ? state.revision + 1
          : state.revision,
      }));
    },

    connect: (connection) => {
      set((state) => ({
        edges: addEdge({ ...connection, id: newClientId(), type: "default" }, state.edges),
        revision: state.revision + 1,
      }));
    },

    addNode: (kind, position) => {
      const id = newClientId();
      const size = WORKFLOW_NODE_SIZE[kind];
      set((state) => ({
        nodes: [
          ...state.nodes,
          {
            id,
            type: kind,
            position,
            width: size.width,
            height: size.height,
            data: defaultData(kind) as WorkflowNode["data"],
          },
        ],
        revision: state.revision + 1,
      }));
      return id;
    },

    updateNodeData: (id, patch) => {
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, ...patch } } : node,
        ),
        revision: state.revision + 1,
      }));
    },

    openBinding: (target) => set({ bindingTarget: target }),
    closeBinding: () => set({ bindingTarget: null }),

    saveInputBinding: (binding) =>
      set((state) => ({
        externalApi: {
          ...state.externalApi,
          inputs: [
            ...state.externalApi.inputs.filter(
              (item) =>
                item.target.nodeId !== binding.target.nodeId ||
                item.target.field !== binding.target.field,
            ),
            binding,
          ],
        },
        bindingTarget: null,
        revision: state.revision + 1,
      })),

    removeInputBinding: (nodeId, field) =>
      set((state) => ({
        externalApi: {
          ...state.externalApi,
          inputs: state.externalApi.inputs.filter(
            (item) => item.target.nodeId !== nodeId || item.target.field !== field,
          ),
        },
        bindingTarget: null,
        revision: state.revision + 1,
      })),

    saveOutputBinding: (binding) =>
      set((state) => ({
        externalApi: {
          ...state.externalApi,
          outputs: [
            ...state.externalApi.outputs.filter((item) => item.nodeId !== binding.nodeId),
            binding,
          ],
        },
        bindingTarget: null,
        revision: state.revision + 1,
      })),

    removeOutputBinding: (nodeId) =>
      set((state) => ({
        externalApi: {
          ...state.externalApi,
          outputs: state.externalApi.outputs.filter((item) => item.nodeId !== nodeId),
        },
        bindingTarget: null,
        revision: state.revision + 1,
      })),

    load: (graph) =>
      set({
        nodes: graph.nodes,
        edges: graph.edges,
        externalApi: graph.externalApi ?? { schemaVersion: 1, inputs: [], outputs: [] },
        bindingTarget: null,
        revision: 0,
        run: null,
      }),

    setRun: (run) => set({ run }),

    applyRunEvent: (event) =>
      set((state) => {
        const run = state.run;
        if (!run || run.id !== event.runId || run.workflowId !== event.workflowId) return {};

        const now = new Date().toISOString();
        const terminalRun =
          event.status === "succeeded" || event.status === "failed" || event.status === "cancelled";
        const terminalNode =
          event.nodeStatus === "succeeded" ||
          event.nodeStatus === "failed" ||
          event.nodeStatus === "cancelled" ||
          event.nodeStatus === "skipped";

        return {
          run: {
            ...run,
            status: event.status,
            error: event.error ?? run.error,
            updatedAt: now,
            startedAt: event.status === "running" ? (run.startedAt ?? now) : run.startedAt,
            finishedAt: terminalRun ? (run.finishedAt ?? now) : run.finishedAt,
            nodes:
              event.nodeId && event.nodeStatus
                ? run.nodes.map((node) =>
                    node.nodeId === event.nodeId
                      ? {
                          ...node,
                          status: event.nodeStatus!,
                          progress: event.progress ?? node.progress,
                          output: event.output ?? node.output,
                          error: event.error ?? node.error,
                          startedAt:
                            event.nodeStatus === "running"
                              ? (node.startedAt ?? now)
                              : node.startedAt,
                          finishedAt: terminalNode ? (node.finishedAt ?? now) : node.finishedAt,
                        }
                      : node,
                  )
                : run.nodes,
          },
        };
      }),

    reset: () =>
      set({
        nodes: [],
        edges: [],
        externalApi: { schemaVersion: 1, inputs: [], outputs: [] },
        bindingTarget: null,
        revision: 0,
        run: null,
      }),
  }));

type WorkflowStore = ReturnType<typeof createWorkflowStore>;
const defaultStore = createWorkflowStore();
const WorkflowStoreContext = createContext<WorkflowStore | null>(null);

/** 每个编辑器独立保存图和运行；脱离编辑器的单元测试使用默认实例。 */
export function WorkflowStoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createWorkflowStore);
  return createElement(WorkflowStoreContext.Provider, { value: store }, children);
}

export function useWorkflowStoreApi() {
  return useContext(WorkflowStoreContext) ?? defaultStore;
}

export const useWorkflowStore = Object.assign(function useScopedWorkflowStore<T>(
  selector: (state: WorkflowState) => T,
) {
  return useStore(useWorkflowStoreApi(), selector);
}, defaultStore);
