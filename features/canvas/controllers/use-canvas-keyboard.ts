"use client";
import { useCanvasStore } from "@/features/canvas/store";
import { useEffect } from "react";

export function useCanvasKeyboard() {
  const undo = useCanvasStore((state) => state.undo),
    redo = useCanvasStore((state) => state.redo),
    selectAll = useCanvasStore((state) => state.selectAll),
    duplicateNode = useCanvasStore((state) => state.duplicateNode);
  // 键盘命令。只要忽略文本输入控件内部的事件，就可以安全使用全局监听器；
  // 在文本控件内，这些组合键应保持常规编辑含义。
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;

      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      switch (event.key.toLowerCase()) {
        case "z":
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
          break;

        case "a":
          event.preventDefault();
          selectAll();
          break;

        case "d": {
          // 复制当前选中内容，与节点右键菜单行为一致。
          const selected = useCanvasStore.getState().nodes.filter((node) => node.selected);
          if (selected.length > 0) {
            event.preventDefault();
            selected.forEach((node) => duplicateNode(node.id));
          }
          break;
        }

        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, selectAll, duplicateNode]);
}
