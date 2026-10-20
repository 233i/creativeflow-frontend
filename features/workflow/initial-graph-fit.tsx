"use client";

import { useNodesInitialized, useReactFlow } from "@xyflow/react";
import { useEffect, useRef } from "react";

/** 所有节点完成测量后只适应一次，后续轮询、选中和页签切换保留用户视角。 */
export function InitialGraphFit() {
  const ready = useNodesInitialized();
  const { fitView } = useReactFlow();
  const fitted = useRef(false);
  useEffect(() => {
    if (!ready || fitted.current) return;
    const frame = requestAnimationFrame(() => {
      if (fitted.current) return;
      fitted.current = true;
      void fitView({ padding: 0.2, maxZoom: 1 });
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, fitView]);
  return null;
}
