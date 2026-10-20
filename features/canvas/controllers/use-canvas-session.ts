"use client";
import { useAiStore } from "@/features/ai/store";
import { resumeVideoJobs } from "@/features/canvas/execution";
import { detachImageJobs, resumeImageJobs } from "@/features/canvas/image-jobs";
import { useCanvasStore } from "@/features/canvas/store";
import {
  persistCanvas,
  rememberCurrentCanvas,
  resolveCanvas,
  type SaveState,
} from "@/features/canvas/sync";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const AUTOSAVE_DELAY_MS = 400;
const HYDRATION_SETTLE_MS = 250;
export function useCanvasSession(canvasId: string, wrapperRef: RefObject<HTMLDivElement | null>) {
  const revision = useCanvasStore((state) => state.revision);
  const load = useCanvasStore((state) => state.load);
  const loadAi = useAiStore((state) => state.load);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const hydrated = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const autosavePending = useRef(false);
  const positionGestures = useRef(new Set<string>());
  const clearAutosaveTimer = useCallback(() => {
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = undefined;
  }, []);

  const scheduleAutosave = useCallback(() => {
    clearAutosaveTimer();
    if (!autosavePending.current || positionGestures.current.size > 0) return;

    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = undefined;

      // 通常在拖动开始时清除此计时器；此处再次检查，确保无论回调顺序如何，
      // 持久化逻辑都不会读取节点的中间位置。
      if (positionGestures.current.size > 0) return;

      autosavePending.current = false;
      const state = useCanvasStore.getState();
      void persistCanvas(canvasId, state.nodes, state.edges).then(setSaveState);
    }, AUTOSAVE_DELAY_MS);
  }, [canvasId, clearAutosaveTimer]);

  // 在首次自动保存前完成恢复，避免空的初始状态覆盖已保存画布。本地副本会立即显示，
  // 若服务端副本更新，则以服务端为准。
  useEffect(() => {
    let cancelled = false;
    let settle: ReturnType<typeof setTimeout> | undefined;
    hydrated.current = false;
    wrapperRef.current?.setAttribute("data-hydrating", "true");

    async function hydrate() {
      const resolved = await resolveCanvas(canvasId);
      if (cancelled) return;

      load({ nodes: resolved.nodes, edges: resolved.edges }, canvasId);
      rememberCurrentCanvas(canvasId);

      // 页面重载后视频任务仍在服务端运行，需要重新挂载轮询器，否则恢复后的节点会永远显示加载状态。
      resumeVideoJobs(resolved.nodes);
      void resumeImageJobs(canvasId, resolved.savedAt);
      hydrated.current = true;

      // 所有恢复节点会在同一次提交中挂载。若让每个节点播放入场动画，打开项目时满屏矩形会同时弹出，
      // 因此在它们完成绘制前一直抑制动画。这里才开始解除计时，而不是与请求同时启动计时器；
      // 后者可能在请求尚未完成时就到期，最终仍让整个画布一起播放入场动画。
      settle = setTimeout(
        () => wrapperRef.current?.removeAttribute("data-hydrating"),
        HYDRATION_SETTLE_MS,
      );
    }

    void hydrate();
    void loadAi();

    return () => {
      cancelled = true;
      detachImageJobs(canvasId);
      clearTimeout(settle);
    };
  }, [canvasId, load, loadAi, wrapperRef]);

  /**
   * 自动保存。
   *
   * 节点实时位置仍会在每个指针帧更新，但修订版本会延迟到释放指针后再变更。
   * 下方拖动回调还会暂停先前编辑启动的计时器，确保其回调不会读取并保存中间位置。
   */
  useEffect(() => {
    if (!hydrated.current) return;

    autosavePending.current = true;
    setSaveState("saving");
    scheduleAutosave();
  }, [revision, scheduleAutosave]);

  useEffect(() => clearAutosaveTimer, [clearAutosaveTimer]);

  const positionGesture = useCallback(
    (name: string, active: boolean) => {
      if (active) {
        positionGestures.current.add(name);
        clearAutosaveTimer();
      } else {
        positionGestures.current.delete(name);
        if (positionGestures.current.size === 0) scheduleAutosave();
      }
    },
    [clearAutosaveTimer, scheduleAutosave],
  );
  return { saveState, positionGesture };
}
