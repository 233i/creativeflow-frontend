import { type KnowledgeDetail } from "@/features/knowledge/api";

export function knowledgeVersionView(detail: KnowledgeDetail, documentVersion: string | null) {
  const { library, versions } = detail;
  const active = versions.find((version) => version.id === library.activeVersion);
  const visibleVersions = versions.filter(
    (version) => !["cleaning", "cleanup_failed", "deleted"].includes(version.status),
  );
  const displayedVersion =
    documentVersion && visibleVersions.some((version) => version.id === documentVersion)
      ? documentVersion
      : (library.activeVersion ?? visibleVersions[0]?.id ?? null);
  return { library, versions, active, visibleVersions, displayedVersion };
}
