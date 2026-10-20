"use client";
import { type DetailSection } from "@/features/admin/workflow-center/detail-context";

export interface WorkflowDetailProps {
  id: string;
  source: "workflow" | "template";
  initialSection: DetailSection;
}
