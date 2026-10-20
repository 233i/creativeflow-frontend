import type { NodeChange } from "@xyflow/react";

/** 第一帧写入前保存起点；多节点分批释放仍只对应一次手势。 */
export function createDragHistoryTracker() {
  const active = new Set<string>();
  return {
    capture(changes: NodeChange[]): boolean {
      const positionChanges = changes.filter((change) => change.type === "position");
      const startsGesture =
        active.size === 0 && positionChanges.some((change) => change.dragging !== undefined);
      for (const change of positionChanges) {
        if (change.dragging === true) active.add(change.id);
        else if (change.dragging === false) active.delete(change.id);
      }
      const structural = changes.some(
        (change) => change.type === "remove" || change.type === "add",
      );
      for (const change of changes) if (change.type === "remove") active.delete(change.id);
      return startsGesture || structural;
    },
    clear: () => active.clear(),
  };
}
