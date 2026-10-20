"use client";
import type { RefObject } from "react";
import { useCallback, useRef } from "react";

export function useCanvasGestures(
  wrapperRef: RefObject<HTMLDivElement | null>,
  positionGesture: (name: string, active: boolean) => void,
) {
  /**
   * 手势进行期间标记包装元素，使 CSS 暂停高开销效果。
   *
   * 直接写入 DOM，而不保存在状态中：该标记本就是为了避免组件重新渲染；
   * 若为宣告“拖动开始”而重新渲染，反而会在最不合适的时机付出这项开销。
   *
   * 按手势类型记录而不是简单计数，因为平移和节点拖动可能重叠；若计数器漏掉一次 `end`
   * （例如指针在窗口外释放，或手势被重新渲染打断），计数会永久大于零，导致模糊效果一直关闭。
   */
  const gestures = useRef(new Set<string>());
  const setGesture = useCallback(
    (name: string, active: boolean) => {
      const live = gestures.current;
      if (active) live.add(name);
      else live.delete(name);

      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      if (live.size > 0) wrapper.setAttribute("data-interacting", "true");
      else wrapper.removeAttribute("data-interacting");
    },
    [wrapperRef],
  );

  const onMoveStart = useCallback(() => setGesture("move", true), [setGesture]);
  const onMoveEnd = useCallback(() => setGesture("move", false), [setGesture]);

  const setPositionGesture = useCallback(
    (name: string, active: boolean) => {
      setGesture(name, active);

      positionGesture(name, active);
    },
    [positionGesture, setGesture],
  );

  const onNodeDragStart = useCallback(() => setPositionGesture("node", true), [setPositionGesture]);
  const onNodeDragStop = useCallback(() => setPositionGesture("node", false), [setPositionGesture]);
  const onSelectionDragStart = useCallback(
    () => setPositionGesture("selection", true),
    [setPositionGesture],
  );
  const onSelectionDragStop = useCallback(
    () => setPositionGesture("selection", false),
    [setPositionGesture],
  );

  return {
    onMoveStart,
    onMoveEnd,
    onNodeDragStart,
    onNodeDragStop,
    onSelectionDragStart,
    onSelectionDragStop,
  };
}
