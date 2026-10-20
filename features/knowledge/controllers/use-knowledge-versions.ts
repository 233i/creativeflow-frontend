"use client";
import { knowledgeApi, type KnowledgeVersion } from "@/features/knowledge/api";
import { useState } from "react";

export function useKnowledgeVersions({
  libraryId,
  versions,
  activeVersion,
  enabled,
  busy,
  run,
  onViewDocuments,
  error = null,
}: {
  libraryId: string;
  versions: KnowledgeVersion[];
  activeVersion: string | null;
  enabled: boolean;
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<boolean>;
  onViewDocuments: (versionId: string) => void;
  error?: string | null;
}) {
  const [confirmation, setConfirmation] = useState<{
    version: KnowledgeVersion;
    type: "activate" | "recover" | "rebuild";
  } | null>(null);
  const [cleanup, setCleanup] = useState<string | null>(null);

  async function confirmVersion() {
    if (!confirmation) return;
    const succeeded = await run(async () => {
      if (confirmation.type === "rebuild") {
        await knowledgeApi.rebuild(libraryId, confirmation.version.id);
        return;
      }
      await (confirmation.type === "activate"
        ? knowledgeApi.activate(libraryId, confirmation.version.id)
        : knowledgeApi.recover(libraryId, confirmation.version.id, "reembedUnknown"));
    });
    if (succeeded) setConfirmation(null);
  }
  function continueVersion(versionId: string) {
    return run(() => knowledgeApi.recover(libraryId, versionId, "continue"));
  }
  return {
    confirmVersion,
    continueVersion,
    libraryId,
    versions,
    activeVersion,
    enabled,
    busy,
    run,
    onViewDocuments,
    error,
    confirmation,
    setConfirmation,
    cleanup,
    setCleanup,
  };
}
export type VersionsPanelController = ReturnType<typeof useKnowledgeVersions>;
