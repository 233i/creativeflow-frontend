"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { create } from "zustand";
import {
  type CanvasNodeData,
  type ExecutionStatus,
  isTerminal,
  NODE_DEFAULT_SIZE,
  type NodeExecution,
  type NodeKind,
} from "@/features/canvas/types";
import { autoLayoutNodes } from "@/features/canvas/layout";
import type { CanvasTemplateDefinition } from "@/features/canvas/templates";
import { newClientId } from "@/lib/client-id";
import { createDragHistoryTracker } from "./drag-history";

/**
 * 画布节点。
 *
 * `type` 保持可选字符串而不缩窄为 `NodeKind`，因为 `useReactFlow().getNodes()` 返回库自身的 `Node`；
 * 若在此缩窄，每个调用点都必须强制转换。使用方通过 `(node.type ?? "text") as NodeKind` 缩窄。
 */
export type CanvasNode = Node<CanvasNodeData & Record<string, unknown>>;
export type CanvasEdge = Edge;

/** 撤销深度。快照与活动状态共享引用，因此成本较低。 */
const HISTORY_LIMIT = 60;

/**
 * 将连续编辑折叠为单个撤销条目的时间边界。
 *
 * 过去输入完全不占撤销槽，Ctrl+Z 会跳回上一次结构变更并丢弃整段文字。
 * 每次按键都拍快照则是另一种失败：撤销一句话需要按六十次 Ctrl+Z。
 * 因此同一节点同一字段的连续编辑会折叠，直到用户暂停或连续输入达到最长时限。
 */
const HISTORY_COALESCE_IDLE_MS = 600;
const HISTORY_COALESCE_MAX_MS = 3000;

interface Snapshot {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

interface CanvasState {
  /** 当前编辑画布，用于将生成请求关联到画布；不进入图快照和撤销历史。 */
  canvasId: string | null;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  past: Snapshot[];
  future: Snapshot[];
  /** 每次可持久化变更时递增；自动保存副作用会监视此值。 */
  revision: number;

  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  addNode: (
    kind: NodeKind,
    position: { x: number; y: number },
    data?: Partial<CanvasNodeData>,
  ) => string;
  /** 将已连接的工作流起始模板作为一次可撤销画布编辑添加。 */
  addTemplate: (template: CanvasTemplateDefinition, position: { x: number; y: number }) => string[];
  /**
   * 修补节点数据。
   *
   * 默认记录撤销步骤，并合并同一字段的一串编辑。用户未执行的内部记录应传 `history: false`；
   * 轮询器写回完成素材 URL 不应占用撤销槽，也不应合并到恰好在它之前发生的编辑中。
   */
  updateNodeData: (
    id: string,
    patch: Partial<CanvasNodeData>,
    options?: { history?: boolean },
  ) => void;
  /**
   * 删除节点以及与任一被删节点相连的所有边。
   *
   * 默认记录撤销步骤。用户未请求的清理应传 `history: false`：
   * 因运行失败而丢弃的占位节点不应在 Ctrl+Z 后恢复，因为永远不会有内容填入它。
   */
  removeNodes: (ids: string[], options?: { history?: boolean }) => void;
  duplicateNode: (id: string) => void;
  /** 在一次可撤销图编辑中排列所有节点。 */
  autoLayout: () => void;
  selectAll: () => void;

  setExecution: (id: string, execution: NodeExecution | undefined) => void;
  patchExecution: (id: string, status: ExecutionStatus, patch?: Partial<NodeExecution>) => void;

  /** 在 `sourceId` 右侧创建输出节点并连接。 */
  spawnOutput: (
    sourceId: string,
    kind: NodeKind,
    data?: Partial<CanvasNodeData>,
    /** 一次运行产生多个输出时的行索引，用于向下堆叠。 */
    stackIndex?: number,
  ) => string | null;

  undo: () => void;
  redo: () => void;
  /** 载入图快照；切换画布时传入标识，导入图时省略以保留当前归属。 */
  load: (snapshot: Snapshot, canvasId?: string) => void;
  reset: () => void;
}

function newId(): string {
  return newClientId();
}

export function newRunId(): string {
  return newId();
}

export const useCanvasStore = create<CanvasState>((set, get) => {
  /** 当前正折叠为一个撤销条目的编辑串（如有）。 */
  let coalescing: { key: string; startedAt: number; lastAt: number } | null = null;
  const dragHistory = createDragHistoryTracker();

  /**
   * 记录当前状态以供撤销。
   *
   * 快照与活动状态共享节点引用，而不是深度克隆。下方所有修改均不可变，因此共享是安全的；
   * 克隆会在每个拖动帧复制整个图。
   *
   * `coalesceKey` 标识正在编辑的内容（节点标识加修补字段）。同一键持续到达时，
   * 编辑串开始时拍摄的快照已经代表编辑前状态，因此无需更多快照。
   */
  function pushHistory(coalesceKey?: string) {
    const now = Date.now();

    if (
      coalesceKey &&
      coalescing?.key === coalesceKey &&
      now - coalescing.lastAt < HISTORY_COALESCE_IDLE_MS &&
      now - coalescing.startedAt < HISTORY_COALESCE_MAX_MS
    ) {
      coalescing.lastAt = now;
      return;
    }

    coalescing = coalesceKey ? { key: coalesceKey, startedAt: now, lastAt: now } : null;

    const { nodes, edges, past } = get();
    const next = [...past, { nodes, edges }];
    set({
      past: next.length > HISTORY_LIMIT ? next.slice(-HISTORY_LIMIT) : next,
      future: [],
    });
  }

  function bump() {
    set((state) => ({ revision: state.revision + 1 }));
  }

  return {
    canvasId: null,
    nodes: [],
    edges: [],
    past: [],
    future: [],
    revision: 0,

    onNodesChange: (changes) => {
      // 撤销快照必须保留第一帧之前的位置，修订号仍只在释放后推进。
      if (dragHistory.capture(changes)) pushHistory();

      set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) }));

      // 选区是临时界面状态，实时拖动帧只移动渲染节点。
      // 最终位置事件（dragging === false）才将整个手势标记为一次可持久化修订。
      if (
        changes.some(
          (change) =>
            change.type !== "select" && !(change.type === "position" && change.dragging === true),
        )
      ) {
        bump();
      }
    },

    onEdgesChange: (changes) => {
      if (changes.some((change) => change.type === "remove")) {
        pushHistory();
      }
      set((state) => ({ edges: applyEdgeChanges(changes, state.edges) }));
      if (changes.some((change) => change.type !== "select")) {
        bump();
      }
    },

    onConnect: (connection) => {
      pushHistory();
      set((state) => ({ edges: addEdge({ ...connection, type: "default" }, state.edges) }));
      bump();
    },

    addNode: (kind, position, data) => {
      pushHistory();

      const id = newId();
      const size = NODE_DEFAULT_SIZE[kind];

      set((state) => ({
        nodes: [
          ...state.nodes,
          {
            id,
            type: kind,
            position,
            data: (data ?? {}) as CanvasNode["data"],
            width: size.width,
            height: size.height,
          },
        ],
      }));

      bump();
      return id;
    },

    addTemplate: (template, position) => {
      pushHistory();

      const ids = new Map(template.nodes.map((spec) => [spec.key, newId()]));
      const createdNodes = template.nodes.map((spec) => {
        const id = ids.get(spec.key)!;
        const size = NODE_DEFAULT_SIZE[spec.kind];

        return {
          id,
          type: spec.kind,
          position: {
            x: position.x + spec.position.x,
            y: position.y + spec.position.y,
          },
          data: (spec.data ?? {}) as CanvasNode["data"],
          width: size.width,
          height: size.height,
        };
      });

      const createdEdges = template.edges.flatMap((spec) => {
        const source = ids.get(spec.source);
        const target = ids.get(spec.target);
        if (!source || !target) return [];

        return [{ id: `e${newId()}`, source, target, type: "default" }];
      });

      set((state) => ({
        nodes: [...state.nodes, ...createdNodes],
        edges: [...state.edges, ...createdEdges],
      }));
      bump();

      return createdNodes.map((node) => node.id);
    },

    updateNodeData: (id, patch, options) => {
      if (options?.history === false) {
        // 这不是用户编辑，因此既不占撤销槽，也不延长正在进行的编辑串；
        // 下一次按键应开始新条目，而不是跨过后台写入合并到旧条目。
        coalescing = null;
      } else {
        // 键同时包含字段和节点：切换模型与随后输入应是两个独立步骤。
        pushHistory(`${id}:${Object.keys(patch).sort().join(",")}`);
      }

      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, ...patch } } : node,
        ),
      }));
      bump();
    },

    removeNodes: (ids, options) => {
      if (ids.length === 0) return;

      if (options?.history === false) {
        // 与 `updateNodeData` 理由相同：后台写入不能延长用户编辑串，
        // 否则下一次按键会跨过后台写入进行合并。
        coalescing = null;
      } else {
        pushHistory();
      }

      const removed = new Set(ids);
      set((state) => ({
        nodes: state.nodes.filter((node) => !removed.has(node.id)),
        // 否则连接已删除节点的边会渲染为悬空线条。
        edges: state.edges.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target)),
      }));
      bump();
    },

    duplicateNode: (id) => {
      const node = get().nodes.find((candidate) => candidate.id === id);
      if (!node) return;

      pushHistory();
      set((state) => ({
        nodes: [
          ...state.nodes,
          {
            ...node,
            id: newId(),
            position: { x: node.position.x + 32, y: node.position.y + 32 },
            selected: false,
            // 副本尚未产生任何内容；若复制执行状态，会在没有输出的节点上显示过期的“成功”。
            data: { ...node.data, execution: undefined },
          },
        ],
      }));
      bump();
    },

    autoLayout: () => {
      const { nodes, edges } = get();
      if (nodes.length < 2) return;

      const nextNodes = autoLayoutNodes(nodes, edges);
      const changed = nextNodes.some(
        (node, index) =>
          node.position.x !== nodes[index].position.x ||
          node.position.y !== nodes[index].position.y,
      );
      if (!changed) return;

      pushHistory();
      set({ nodes: nextNodes });
      bump();
    },

    /** 选区属于视图状态，因此刻意跳过历史记录和自动保存。 */
    selectAll: () => {
      set((state) => ({ nodes: state.nodes.map((node) => ({ ...node, selected: true })) }));
    },

    setExecution: (id, execution) => {
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, execution } } : node,
        ),
      }));
    },

    patchExecution: (id, status, patch) => {
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id !== id) return node;

          const current = (node.data as { execution?: NodeExecution }).execution;
          const execution: NodeExecution = {
            runId: current?.runId ?? newRunId(),
            ...current,
            ...patch,
            status,
            ...(status === "running" && !current?.startedAt ? { startedAt: Date.now() } : {}),
            ...(isTerminal(status) ? { finishedAt: Date.now() } : {}),
          };

          return { ...node, data: { ...node.data, execution } };
        }),
      }));

      // 终止结果值得持久化，进度更新则不值得；若视频轮询每一帧都递增，
      // 会每隔几秒无意义地重写存储。
      if (isTerminal(status)) {
        bump();
      }
    },

    spawnOutput: (sourceId, kind, data, stackIndex = 0) => {
      const source = get().nodes.find((node) => node.id === sourceId);
      if (!source) return null;

      const id = newId();
      const size = NODE_DEFAULT_SIZE[kind];
      const sourceWidth =
        source.width ?? NODE_DEFAULT_SIZE[(source.type ?? "text") as NodeKind].width;

      // 放在源节点右侧并自动连接，使运行可见地扩展图，而不是静默修改启动它的节点。
      // 一次运行的多个输出向下堆叠；偏移在此直接应用，而不是事后修补，
      // 因此放置属于同一历史条目，并只触发一次自动保存。
      set((state) => ({
        nodes: [
          ...state.nodes,
          {
            id,
            type: kind,
            position: {
              x: source.position.x + sourceWidth + 60,
              y: source.position.y + stackIndex * (size.height + 24),
            },
            data: (data ?? {}) as CanvasNode["data"],
            width: size.width,
            height: size.height,
          },
        ],
        edges: [...state.edges, { id: `e${sourceId}-${id}`, source: sourceId, target: id }],
      }));

      bump();
      return id;
    },

    undo: () => {
      const { past, nodes, edges } = get();
      const previous = past.at(-1);
      if (!previous) return;

      // 撤销后继续的编辑不能合并到刚弹出的条目中。
      coalescing = null;
      dragHistory.clear();

      set((state) => ({
        nodes: previous.nodes,
        edges: previous.edges,
        past: past.slice(0, -1),
        future: [{ nodes, edges }, ...state.future].slice(0, HISTORY_LIMIT),
      }));
      bump();
    },

    redo: () => {
      const { future, nodes, edges } = get();
      const next = future[0];
      if (!next) return;

      coalescing = null;
      dragHistory.clear();

      set((state) => ({
        nodes: next.nodes,
        edges: next.edges,
        past: [...state.past, { nodes, edges }].slice(-HISTORY_LIMIT),
        future: future.slice(1),
      }));
      bump();
    },

    /** 图导入保留当前画布归属；切换画布时由调用方明确传入新标识。 */
    load: (snapshot, canvasId) => {
      coalescing = null;
      dragHistory.clear();
      set({
        canvasId: canvasId ?? get().canvasId,
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        past: [],
        future: [],
        revision: 0,
      });
    },

    /** 清空完整编辑会话，后续必须载入画布才重新建立生成归属。 */
    reset: () => {
      coalescing = null;
      dragHistory.clear();
      set({ canvasId: null, nodes: [], edges: [], past: [], future: [], revision: 0 });
    },
  };
});
