"use client";
import { useCallback, useState } from "react";
import type { CanvasMenu } from "./editor-types";

export function useCanvasMenu() {
  const [menu, setMenu] = useState<CanvasMenu | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, nodeId: null, edgeId: null });
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: { id: string }) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, nodeId: node.id, edgeId: null });
  }, []);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: { id: string }) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, nodeId: null, edgeId: edge.id });
  }, []);

  return { menu, setMenu, closeMenu, onPaneContextMenu, onNodeContextMenu, onEdgeContextMenu };
}
