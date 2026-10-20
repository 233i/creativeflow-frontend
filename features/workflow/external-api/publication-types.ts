"use client";
import type { PublicationManifest } from "@/features/workflow/external-api/contracts";

export interface PublicationProps {
  workflowId: string;
  workflowName: string;
  updatedAt: string;
  manifest: PublicationManifest;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onBeforePublish: () => Promise<boolean>;
  page?: "publications" | "access";
  onPendingChange?: (dirtyRef: boolean, save: null, busy: boolean) => void;
}
