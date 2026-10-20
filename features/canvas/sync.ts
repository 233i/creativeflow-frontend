"use client";

import * as api from "@/features/canvas/api";
import { loadLocal, saveLocal, toSnapshot } from "@/features/canvas/persistence";
import type { CanvasEdge, CanvasNode } from "@/features/canvas/store";

/**
 * 协调本地缓存与服务器副本。
 *
 * localStorage 仍是读取路径，可即时绘制并离线工作。服务器保存持久副本。
 * 加载时同时检查两者，较新的副本胜出；变更时立即写入本地，服务器写入由调用方防抖。
 *
 * 此处按时间戳最后写入胜出已经足够：画布属于一个设备，真正的并发编辑意味着同一用户打开了两个标签页，
 * 失败一方仍可通过撤销恢复。
 */

/** 多画布出现前，单个硬编码画布使用的键。 */
const LEGACY_LOCAL_ID = "default";

const CURRENT_ID_KEY = "sol.canvas.current";

export interface ResolvedCanvas {
  id: string;
  /** 只有本地副本可达时为空，由调用方提供自己的标签。 */
  name: string | null;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  /** 本地副本较新且已推送时为真。 */
  pushedLocal: boolean;
  /** 选中的快照时间，用于补回关闭页面期间新接受的任务。 */
  savedAt: number;
}

export function rememberCurrentCanvas(id: string): void {
  try {
    window.localStorage.setItem(CURRENT_ID_KEY, id);
  } catch {
    // 隐私窗口存储失败不值得破坏导航。
  }
}

export function lastOpenedCanvas(): string | null {
  try {
    return window.localStorage.getItem(CURRENT_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * 将多画布出现前的本地文档迁移到服务器。
 *
 * 返回新画布标识；没有可迁移内容时返回空。此操作在查询画布列表前运行，
 * 使只有隐式“默认”画布的用户保留工作，而不是进入新的空画布。
 */
export async function migrateLegacyCanvas(name: string): Promise<string | null> {
  const legacy = loadLocal(LEGACY_LOCAL_ID);
  if (!legacy || legacy.nodes.length === 0) {
    // 没有值得保留的内容。清除键，防止再次运行。
    clearLegacy();
    return null;
  }

  const created = await api.createCanvas(name, {
    nodes: legacy.nodes,
    edges: legacy.edges,
  });

  saveLocal(created.id, legacy.nodes, legacy.edges);
  clearLegacy();
  rememberCurrentCanvas(created.id);

  return created.id;
}

function clearLegacy(): void {
  try {
    window.localStorage.removeItem(`sol.canvas.${LEGACY_LOCAL_ID}`);
  } catch {
    // 忽略。
  }
}

/**
 * 将已存储图强制转换为可用数组。
 *
 * 新建画布尚无图，旧客户端也可能写入不完整图。两者都会表现为真值对象却缺少 `nodes` 或 `edges`，
 * 从而把未定义值写入存储，并在下一次渲染时抛错。
 */
function readGraph(graph: { nodes?: CanvasNode[]; edges?: CanvasEdge[] } | null | undefined): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
} {
  return {
    nodes: Array.isArray(graph?.nodes) ? graph.nodes : [],
    edges: Array.isArray(graph?.edges) ? graph.edges : [],
  };
}

/**
 * 加载画布，并优先使用较新的副本。
 *
 * 服务器失败并非致命：返回本地副本以继续编辑，下次成功保存时重新同步。
 * 这很重要，因为另一选择是拒绝打开用户本地已有画布，
 * 会把临时网络问题变成用户无法访问的数据。
 */
export async function resolveCanvas(id: string): Promise<ResolvedCanvas> {
  const local = loadLocal(id);

  let remote: api.CanvasDocument | null = null;
  try {
    remote = await api.getCanvas(id);
  } catch (error) {
    if (error instanceof api.CanvasApiError && !error.isNotFound) {
      // 网络或认证问题；回退到本地副本，而不是失去访问权限。
      if (local) {
        return {
          id,
          name: null,
          nodes: local.nodes,
          edges: local.edges,
          pushedLocal: false,
          savedAt: local.savedAt,
        };
      }
    }
  }

  const remoteUpdated = remote ? Date.parse(remote.updatedAt) : 0;
  const localSaved = local?.savedAt ?? 0;

  // 本地副本较新：将其推送，防止离线编辑的画布被旧副本静默替换。
  if (local && localSaved > remoteUpdated) {
    let pushed = false;
    try {
      await api.saveCanvas(id, { nodes: local.nodes, edges: local.edges });
      pushed = true;
    } catch {
      // 持久化等待下次保存；编辑本身不会丢失。
    }

    return {
      id,
      name: remote?.name ?? null,
      nodes: local.nodes,
      edges: local.edges,
      pushedLocal: pushed,
      savedAt: localSaved,
    };
  }

  if (remote) {
    const graph = readGraph(remote.graph);
    saveLocal(id, graph.nodes, graph.edges);

    return {
      id,
      name: remote.name,
      nodes: graph.nodes,
      edges: graph.edges,
      pushedLocal: false,
      savedAt: remoteUpdated,
    };
  }

  return {
    id,
    name: null,
    nodes: local?.nodes ?? [],
    edges: local?.edges ?? [],
    pushedLocal: false,
    savedAt: localSaved,
  };
}

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * 写入两个副本。
 *
 * 本地写入始终无条件先执行，因此服务器失败绝不会让用户丢失编辑，
 * 只会在下次成功保存前暂时失去持久性。
 */
export async function persistCanvas(
  id: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): Promise<SaveState> {
  saveLocal(id, nodes, edges);

  // 与本地副本使用相同清理：不保留 blob 或 data URL，也不保留虚假的 `running` 运行。
  const snapshot = toSnapshot(nodes, edges);

  try {
    await api.saveCanvas(id, { nodes: snapshot.nodes, edges: snapshot.edges });
    return "saved";
  } catch {
    return "error";
  }
}
