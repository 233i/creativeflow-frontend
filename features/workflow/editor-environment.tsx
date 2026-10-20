"use client";

import { createContext, useContext } from "react";
import { uploadAsset } from "@/features/ai/api";
import type { WorkflowEditorAssets } from "./editor-assets";

interface WorkflowEditorEnvironment {
  canManageApi: boolean;
  assets?: WorkflowEditorAssets;
}

/** 默认的普通编辑器不提供 API 参数编辑和发布入口。 */
export const WorkflowEditorEnvironmentContext = createContext<WorkflowEditorEnvironment>({
  canManageApi: false,
});

const originalAssetUrl = (url: string) => url;

export function useWorkflowEditorEnvironment() {
  const environment = useContext(WorkflowEditorEnvironmentContext);
  return {
    ...environment,
    uploadAsset: environment.assets?.uploadAsset ?? uploadAsset,
    assetUrl: environment.assets?.assetUrl ?? originalAssetUrl,
  };
}
