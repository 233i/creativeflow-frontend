"use client";
import { useT } from "@/components/providers/i18n-provider";
import { registerAgentCanvasControls } from "@/features/agent/canvas-control";
import { useAgentStore } from "@/features/agent/store";
import { useCanvasStore } from "@/features/canvas/store";
import { BackgroundVariant, useReactFlow } from "@xyflow/react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CanvasEditorProps } from "./editor-types";
import { useCanvasActions } from "./use-canvas-actions";
import { useCanvasGestures } from "./use-canvas-gestures";
import { useCanvasKeyboard } from "./use-canvas-keyboard";
import { useCanvasMenu } from "./use-canvas-menu";
import { useCanvasSession } from "./use-canvas-session";

export function useCanvasEditor(props: CanvasEditorProps) {
  const { canvasId } = props;
  const t = useT();
  const { resolvedTheme } = useTheme();
  const { getNodes, getEdges, fitView, zoomIn, zoomOut } = useReactFlow();

  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const onNodesChange = useCanvasStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasStore((state) => state.onEdgesChange);
  const onConnect = useCanvasStore((state) => state.onConnect);
  const duplicateNode = useCanvasStore((state) => state.duplicateNode);
  const removeNodes = useCanvasStore((state) => state.removeNodes);
  const selectAll = useCanvasStore((state) => state.selectAll);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const load = useCanvasStore((state) => state.load);

  const agentOpen = useAgentStore((state) => state.open);
  const setAgentOpen = useAgentStore((state) => state.setOpen);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [background, setBackground] = useState<BackgroundVariant | "none">(BackgroundVariant.Dots);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const menu = useCanvasMenu();
  const session = useCanvasSession(canvasId, wrapperRef);
  const actions = useCanvasActions(wrapperRef, menu.closeMenu);
  const gestures = useCanvasGestures(wrapperRef, session.positionGesture);
  useCanvasKeyboard();
  useEffect(
    () =>
      registerAgentCanvasControls({
        fitView: () => fitView({ duration: 200, maxZoom: 1 }),
        zoomIn: () => zoomIn({ duration: 150 }),
        zoomOut: () => zoomOut({ duration: 150 }),
      }),
    [fitView, zoomIn, zoomOut],
  );

  /**
   * 向运行中节点输送数据的边会绘制成流动虚线，让生成过程看起来像沿图传递，
   * 而不是只有一个加载指示器停在框内。
   *
   * 依赖合并后的忙碌节点 ID 列表，而不是拖动时每帧引用都会变化的 `nodes`。
   * 在绝大多数没有任务运行的情况下，只需遍历一次确认，随后原样返回原数组。
   */
  const busyKey = nodes
    .filter((node) => {
      const status = (node.data as { execution?: { status?: string } }).execution?.status;
      return status === "queued" || status === "running";
    })
    .map((node) => node.id)
    .join(",");

  const flowEdges = useMemo(() => {
    if (!busyKey) return edges;
    const busy = new Set(busyKey.split(","));
    return edges.map((edge) => (busy.has(edge.target) ? { ...edge, animated: true } : edge));
  }, [edges, busyKey]);

  return {
    ...props,
    t,
    resolvedTheme,
    nodes,
    edges,
    flowEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    duplicateNode,
    removeNodes,
    selectAll,
    undo,
    redo,
    load,
    agentOpen,
    setAgentOpen,
    settingsOpen,
    setSettingsOpen,
    promptsOpen,
    setPromptsOpen,
    assetsOpen,
    setAssetsOpen,
    templatesOpen,
    setTemplatesOpen,
    background,
    setBackground,
    wrapperRef,
    importRef,
    getNodes,
    getEdges,
    fitView,
    ...menu,
    ...session,
    ...actions,
    ...gestures,
  };
}
export type CanvasController = ReturnType<typeof useCanvasEditor>;
