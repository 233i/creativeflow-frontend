"use client";
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow } from "@xyflow/react";
import { Loader2, MousePointer2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useT } from "@/components/providers/i18n-provider";
import { WorkflowPartialRerunPreviewProvider } from "../partial-rerun-preview";
import { NODE_TYPES, PRO_OPTIONS, FIT_VIEW_OPTIONS, DELETE_KEYS } from "./media-node-types";
import type { MediaEditorModel } from "../controllers/use-media-editor";
export function MediaCanvas({ editor, managed }: { editor: MediaEditorModel; managed: boolean }) {
  const t = useT();
  const { resolvedTheme } = useTheme();
  const { onNodesChange, onEdgesChange, onConnect, isValidConnection } = editor.canvas;
  const { displayNodes, displayEdges, nodeColour } = editor.presentation;
  const partialRerunSourceNodeIds = editor.sourceNodeIds;
  const partialRerunPreview = editor.partial.selection?.preview ?? null;
  const partialRerunPreviewPendingNodeId = editor.partial.selection?.pendingNodeId;
  const partialRerunSelecting = !!editor.partial.selection;
  return (
    <>
      <WorkflowPartialRerunPreviewProvider
        sourceNodeIds={partialRerunSourceNodeIds}
        preview={partialRerunPreview}
      >
        {/* 预留节点库和顶栏的可见区域，首次 fitView 不再把上游节点放到工具栏下面。 */}
        <div
          className={
            managed
              ? "absolute inset-0"
              : "absolute inset-x-0 top-40 bottom-0 sm:top-32 md:top-16 md:left-52"
          }
        >
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={NODE_TYPES}
            onNodesChange={partialRerunSelecting ? undefined : onNodesChange}
            onEdgesChange={partialRerunSelecting ? undefined : onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_event, node) => {
              if (partialRerunSelecting) void editor.partial.choose(node.id);
              else if (managed) editor.panels.inspectNode(node.id);
            }}
            isValidConnection={isValidConnection}
            deleteKeyCode={partialRerunSelecting ? null : DELETE_KEYS}
            nodesConnectable={!partialRerunSelecting}
            nodesDraggable={!partialRerunSelecting}
            fitView
            fitViewOptions={FIT_VIEW_OPTIONS}
            proOptions={PRO_OPTIONS}
            colorMode={resolvedTheme === "dark" ? "dark" : "light"}
            minZoom={0.15}
            maxZoom={2}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
            <Controls position="bottom-right" showInteractive={false} />
            <MiniMap
              position="bottom-right"
              className="!right-14 !hidden !h-24 !w-36 overflow-hidden rounded-lg border bg-background/95 md:!block"
              nodeColor={nodeColour}
            />
          </ReactFlow>
        </div>
      </WorkflowPartialRerunPreviewProvider>

      {partialRerunSelecting && (
        <div className="pointer-events-none absolute top-44 left-1/2 z-20 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg border border-amber-500/30 bg-background px-3 py-2 text-xs font-medium text-amber-700 shadow-node sm:top-36 md:top-20 dark:text-amber-300">
          {partialRerunPreviewPendingNodeId ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <MousePointer2 className="size-3.5" aria-hidden />
          )}
          {t("workflow.partialRerunCanvasHint")}
        </div>
      )}
    </>
  );
}
