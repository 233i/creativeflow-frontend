"use client";
import { centredAt, useImageDrop, usePasteImages } from "@/features/canvas/canvas-interactions";
import { useCanvasStore } from "@/features/canvas/store";
import { type CanvasTemplateDefinition } from "@/features/canvas/templates";
import { NODE_DEFAULT_SIZE, type NodeKind } from "@/features/canvas/types";
import { wouldCreateCycle } from "@/features/canvas/upstream";
import { useReactFlow, type Connection } from "@xyflow/react";
import type { RefObject } from "react";
import { useCallback } from "react";

function clientCentre(wrapper: HTMLDivElement | null) {
  const bounds = wrapper?.getBoundingClientRect();
  return {
    x: (bounds?.left ?? 0) + (bounds?.width ?? 800) / 2,
    y: (bounds?.top ?? 0) + (bounds?.height ?? 600) / 2,
  };
}

export function useCanvasActions(
  wrapperRef: RefObject<HTMLDivElement | null>,
  closeMenu: () => void,
) {
  const { screenToFlowPosition, getNodes, getEdges, fitView } = useReactFlow();
  const addNode = useCanvasStore((state) => state.addNode),
    addTemplate = useCanvasStore((state) => state.addTemplate),
    autoLayout = useCanvasStore((state) => state.autoLayout);
  /** 以流程坐标表示的视口中心，用作粘贴图片的落点。 */
  const viewportCentre = useCallback(() => {
    return screenToFlowPosition(clientCentre(wrapperRef.current));
  }, [screenToFlowPosition, wrapperRef]);

  const dropImages = useImageDrop();
  usePasteImages(
    useCallback((files, at) => void dropImages(files, centredAt(at, "image")), [dropImages]),
    viewportCentre,
  );

  const addAt = useCallback(
    (kind: NodeKind, client?: { x: number; y: number }) => {
      if (client) {
        addNode(kind, screenToFlowPosition(client));
        closeMenu();
        return;
      }

      // 从工具栏添加的节点放到已有内容右侧。图从左向右阅读（上游输入位于左侧），
      // 因此追加节点符合用户当前的构建方向，也不会覆盖已有节点。
      const existing = getNodes();
      const size = NODE_DEFAULT_SIZE[kind];

      if (existing.length > 0) {
        let rightmost = existing[0];
        for (const node of existing) {
          const edge = node.position.x + (node.width ?? 0);
          if (edge > rightmost.position.x + (rightmost.width ?? 0)) rightmost = node;
        }

        addNode(kind, {
          x: rightmost.position.x + (rightmost.width ?? size.width) + 60,
          y: rightmost.position.y,
        });
        closeMenu();
        return;
      }

      const position = screenToFlowPosition(clientCentre(wrapperRef.current));

      addNode(kind, {
        x: position.x - size.width / 2,
        y: position.y - size.height / 2,
      });
      closeMenu();
    },
    [addNode, screenToFlowPosition, getNodes, closeMenu, wrapperRef],
  );

  const addTemplateAt = useCallback(
    (template: CanvasTemplateDefinition) => {
      const existing = getNodes();
      let origin: { x: number; y: number };

      if (existing.length > 0) {
        let rightmost = existing[0];
        for (const node of existing) {
          const nodeWidth =
            node.width ?? NODE_DEFAULT_SIZE[(node.type ?? "text") as NodeKind].width;
          const rightmostWidth =
            rightmost.width ?? NODE_DEFAULT_SIZE[(rightmost.type ?? "text") as NodeKind].width;
          if (node.position.x + nodeWidth > rightmost.position.x + rightmostWidth) {
            rightmost = node;
          }
        }

        origin = {
          x:
            rightmost.position.x +
            (rightmost.width ?? NODE_DEFAULT_SIZE[(rightmost.type ?? "text") as NodeKind].width) +
            80,
          y: rightmost.position.y,
        };
      } else {
        const width = Math.max(
          ...template.nodes.map((node) => node.position.x + NODE_DEFAULT_SIZE[node.kind].width),
        );
        const height = Math.max(
          ...template.nodes.map((node) => node.position.y + NODE_DEFAULT_SIZE[node.kind].height),
        );
        const centre = viewportCentre();
        origin = { x: centre.x - width / 2, y: centre.y - height / 2 };
      }

      const created = addTemplate(template, origin);
      closeMenu();

      // 模板可能高于当前视图。等待 React Flow 收到新的受控节点后，只适配新插入的图，
      // 使示例立即可见。
      window.requestAnimationFrame(() => {
        void fitView({
          nodes: created.map((id) => ({ id })),
          duration: 250,
          maxZoom: 1,
          padding: 0.2,
        });
      });
    },
    [addTemplate, fitView, getNodes, viewportCentre, closeMenu],
  );

  const runAutoLayout = useCallback(() => {
    autoLayout();
    closeMenu();

    // React Flow 会在下次渲染时收到受控节点位置。提交后再适配视图，
    // 即使重新排列后的图大于视口，也能立即完整显示。
    window.requestAnimationFrame(() => {
      void fitView({ duration: 250, maxZoom: 1, padding: 0.2 });
    });
  }, [autoLayout, fitView, closeMenu]);

  /**
   * 拒绝会形成环路的连接。
   *
   * `collectUpstream` 能容忍循环，但成环几乎总是误拖操作，并会悄然截断它收集到的提示词。
   */
  const isValidConnection = useCallback(
    (connection: Connection | { source: string; target: string }) =>
      !wouldCreateCycle(connection.source, connection.target, getEdges()),
    [getEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    // 必须阻止默认行为，才能触发放置事件。
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/"));
      if (files.length === 0) return;

      event.preventDefault();
      const at = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      void dropImages(files, centredAt(at, "image"));
    },
    [dropImages, screenToFlowPosition],
  );

  return {
    viewportCentre,
    addAt,
    addTemplateAt,
    runAutoLayout,
    isValidConnection,
    onDragOver,
    onDrop,
  };
}
