"use client";
import { type CanvasSummary } from "@/features/canvas/api";
import { type Dispatch, type SetStateAction } from "react";

export interface CanvasEditorProps {
  canvasId: string;
  projects: CanvasSummary[];
  onProjectsChange: Dispatch<SetStateAction<CanvasSummary[]>>;
  onSwitch: (id: string) => void;
}
export interface CanvasMenu {
  x: number;
  y: number;
  nodeId: string | null;
  edgeId: string | null;
}
