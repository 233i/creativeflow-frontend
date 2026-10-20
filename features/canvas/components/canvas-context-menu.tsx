"use client";
import {
  Copy,
  Film,
  ImageIcon,
  LayoutGrid,
  Maximize,
  SquareDashed,
  Trash2,
  Type,
  Wand2,
  Workflow,
} from "lucide-react";
import type { CanvasController } from "../controllers/use-canvas-editor";
import { MenuItem } from "./canvas-controls";
export function CanvasContextMenu({ controller }: { controller: CanvasController }) {
  const {
    t,
    menu,
    closeMenu,
    duplicateNode,
    setMenu,
    fitView,
    removeNodes,
    onEdgesChange,
    addAt,
    setTemplatesOpen,
    selectAll,
    runAutoLayout,
  } = controller;
  return (
    <>
      {" "}
      {menu && (
        <>
          {/* 点击外部区域的遮罩层，使菜单即使覆盖节点也能关闭。 */}
          <div className="fixed inset-0 z-20" onClick={closeMenu} />
          <div
            className="canvas-menu fixed z-30 flex min-w-40 origin-top-left flex-col rounded-lg border bg-popover p-1 shadow-lg"
            style={{ left: menu.x, top: menu.y }}
          >
            {menu.nodeId ? (
              <>
                <MenuItem
                  icon={Copy}
                  label={t("canvas.duplicateNode")}
                  onSelect={() => {
                    duplicateNode(menu.nodeId!);
                    setMenu(null);
                  }}
                />
                <MenuItem
                  icon={Maximize}
                  label={t("canvas.fitView")}
                  onSelect={() => {
                    void fitView({ nodes: [{ id: menu.nodeId! }], duration: 200, maxZoom: 1.2 });
                    setMenu(null);
                  }}
                />
                <div className="my-1 h-px bg-border" />
                <MenuItem
                  icon={Trash2}
                  label={t("canvas.deleteNode")}
                  destructive
                  onSelect={() => {
                    removeNodes([menu.nodeId!]);
                    setMenu(null);
                  }}
                />
              </>
            ) : menu.edgeId ? (
              <MenuItem
                icon={Trash2}
                label={t("canvas.deleteConnection")}
                destructive
                onSelect={() => {
                  onEdgesChange([{ type: "remove", id: menu.edgeId! }]);
                  setMenu(null);
                }}
              />
            ) : (
              <>
                {(
                  [
                    ["text", t("canvas.nodeText"), Type],
                    ["image", t("canvas.nodeImage"), ImageIcon],
                    ["imageGen", t("canvas.nodeImageGen"), Wand2],
                    ["videoGen", t("canvas.nodeVideoGen"), Film],
                  ] as const
                ).map(([kind, label, Icon]) => (
                  <MenuItem
                    key={kind}
                    icon={Icon}
                    label={label}
                    onSelect={() => addAt(kind, { x: menu.x, y: menu.y })}
                  />
                ))}
                <div className="my-1 h-px bg-border" />
                <MenuItem
                  icon={Workflow}
                  label={t("canvas.workflowTemplates")}
                  onSelect={() => {
                    setTemplatesOpen(true);
                    setMenu(null);
                  }}
                />
                <div className="my-1 h-px bg-border" />
                <MenuItem
                  icon={SquareDashed}
                  label={t("canvas.selectAll")}
                  onSelect={() => {
                    selectAll();
                    setMenu(null);
                  }}
                />
                <MenuItem
                  icon={LayoutGrid}
                  label={t("canvas.autoArrange")}
                  onSelect={runAutoLayout}
                />
                <MenuItem
                  icon={Maximize}
                  label={t("canvas.fitView")}
                  onSelect={() => {
                    void fitView({ duration: 200, maxZoom: 1 });
                    setMenu(null);
                  }}
                />
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
