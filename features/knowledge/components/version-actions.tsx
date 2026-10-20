"use client";
import { Button } from "@/components/ui/button";
import { type KnowledgeVersion } from "@/features/knowledge/api";
import type { VersionsPanelController } from "@/features/knowledge/controllers/use-knowledge-versions";
export function VersionActions({
  controller,
  version,
}: {
  controller: VersionsPanelController;
  version: KnowledgeVersion;
}) {
  const { canActivate, canRebuild, canClean } = versionFlags(version, controller.activeVersion);
  const { continueVersion, enabled, busy, onViewDocuments, setConfirmation, setCleanup } =
    controller;
  return (
    <td>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          isDisabled={
            !enabled || busy || ["cleaning", "cleanup_failed", "deleted"].includes(version.status)
          }
          onPress={() => onViewDocuments(version.id)}
        >
          查看文档
        </Button>
        {canActivate && (
          <Button
            size="sm"
            isDisabled={!enabled || busy}
            onPress={() => setConfirmation({ version, type: "activate" })}
          >
            激活此版本
          </Button>
        )}
        {canRebuild && (
          <Button
            variant="outline"
            size="sm"
            isDisabled={!enabled || busy}
            onPress={() => setConfirmation({ version, type: "rebuild" })}
          >
            重建混合索引
          </Button>
        )}
        {version.status === "failed" && (
          <Button
            variant="outline"
            size="sm"
            isDisabled={!enabled || busy}
            onPress={() => void continueVersion(version.id)}
          >
            {version.embeddedCount === version.chunkCount
              ? "重写索引（不调用模型）"
              : "从检查点继续"}
          </Button>
        )}
        {version.status === "unknown" && (
          <Button
            variant="outline"
            size="sm"
            isDisabled={!enabled || busy}
            onPress={() => setConfirmation({ version, type: "recover" })}
          >
            核对并恢复
          </Button>
        )}
        {canClean && (
          <Button
            variant="ghost"
            size="sm"
            isDisabled={busy}
            onPress={() => setCleanup(version.id)}
          >
            {version.status === "cleanup_failed" ? "重试清理" : "清理"}
          </Button>
        )}
      </div>
    </td>
  );
}
function versionFlags(version: KnowledgeVersion, activeVersion: string | null) {
  const ready = version.status === "ready";
  const inactive = version.id !== activeVersion;
  return {
    canActivate: ready && inactive,
    canRebuild: ready && version.indexSchema !== "hybrid-v1",
    canClean: ["ready", "failed", "unknown", "cleanup_failed"].includes(version.status) && inactive,
  };
}
