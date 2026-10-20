"use client";
import { AgentPanel } from "@/features/agent/agent-panel";
import { AgentRuntime } from "@/features/agent/agent-runtime";
import { AssetLibraryDialog } from "@/features/canvas/asset-library-dialog";
import { PromptLibraryDialog } from "@/features/canvas/prompt-library-dialog";
import { WorkflowTemplateDialog } from "@/features/canvas/workflow-template-dialog";
import { SettingsDialog } from "@/features/settings/settings-dialog";
import { cn } from "@/lib/utils";
import { Background, Controls, MiniMap, ReactFlow } from "@xyflow/react";
import type { CanvasEditorProps } from "../controllers/editor-types";
import { useCanvasEditor } from "../controllers/use-canvas-editor";
import { CanvasContextMenu } from "./canvas-context-menu";
import { CanvasPalette } from "./canvas-palette";
import { CanvasToolbar } from "./canvas-toolbar";
import { NODE_TYPES } from "./node-types";

const PRO_OPTIONS = { hideAttribution: true };
const FIT_VIEW_OPTIONS = { maxZoom: 1, padding: 0.2 };
const DELETE_KEY_CODES = ["Backspace", "Delete"];
export function CanvasEditor(props: CanvasEditorProps) {
  const controller = useCanvasEditor(props);
  const {
    canvasId,
    wrapperRef,
    nodes,
    flowEdges,
    resolvedTheme,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    onMoveStart,
    onMoveEnd,
    onNodeDragStart,
    onNodeDragStop,
    onSelectionDragStart,
    onSelectionDragStop,
    onPaneContextMenu,
    onNodeContextMenu,
    onEdgeContextMenu,
    closeMenu,
    onDragOver,
    onDrop,
    background,
    agentOpen,
    promptsOpen,
    setPromptsOpen,
    templatesOpen,
    setTemplatesOpen,
    addTemplateAt,
    assetsOpen,
    setAssetsOpen,
    viewportCentre,
    settingsOpen,
    setSettingsOpen,
  } = controller;
  return (
    <div ref={wrapperRef} className="studio-canvas relative size-full bg-canvas">
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        // React Flow 会自行设置控件、小地图和边等界面元素的样式，且无论页面主题如何都默认使用浅色。
        // 若不指定此项，深色模式下缩放按钮会显示为白底白色图标，实际不可见。
        colorMode={
          resolvedTheme === "dark" ? "dark" : resolvedTheme === "light" ? "light" : "system"
        }
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onMoveStart={onMoveStart}
        onMoveEnd={onMoveEnd}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onSelectionDragStart={onSelectionDragStart}
        onSelectionDragStop={onSelectionDragStop}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneClick={closeMenu}
        onDragOver={onDragOver}
        onDrop={onDrop}
        proOptions={PRO_OPTIONS}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={0.15}
        maxZoom={3}
        deleteKeyCode={DELETE_KEY_CODES}
        className="bg-canvas"
      >
        {background !== "none" && <Background variant={background} gap={24} size={1} />}
        <Controls className="!bottom-4 !left-4" />
        {/* 颜色由 colorMode 提供；在此覆盖会与深色调色板冲突，并在遮罩周围留下浅色圆环。 */}
        <MiniMap
          className={cn(
            "!bottom-16 !rounded-lg !border !border-border max-sm:!hidden",
            agentOpen ? "!right-[25rem] max-lg:!hidden" : "!right-4",
          )}
          pannable
          zoomable
          nodeColor="var(--color-muted-foreground)"
        />
      </ReactFlow>

      <CanvasPalette controller={controller} />
      <CanvasToolbar controller={controller} />
      <AgentRuntime canvasId={canvasId} />
      {agentOpen && <AgentPanel />}

      <CanvasContextMenu controller={controller} />
      <PromptLibraryDialog
        isOpen={promptsOpen}
        onOpenChange={setPromptsOpen}
        // 插入当前选中的文本节点；未选择节点时创建一个新节点。
        targetNodeId={nodes.find((node) => node.selected && node.type === "text")?.id ?? null}
      />

      <WorkflowTemplateDialog
        isOpen={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onSelect={addTemplateAt}
      />

      {/* 仅在打开时挂载，使每次打开都会重新获取数据并重置选择。 */}
      {assetsOpen && <AssetLibraryDialog onOpenChange={setAssetsOpen} at={viewportCentre} />}

      <SettingsDialog isOpen={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
