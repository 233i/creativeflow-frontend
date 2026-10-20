import { describe, expect, it } from "vitest";
import type { KnowledgeDetail, KnowledgeVersion } from "./api";
import { knowledgeVersionView } from "./version-selection";

const version = (id: string, status: KnowledgeVersion["status"] = "ready"): KnowledgeVersion => ({
  id,
  status,
  error: null,
  documentCount: 1,
  chunkCount: 1,
  embeddedCount: 1,
  createdAt: "2026-09-01T00:00:00Z",
});
const detail: KnowledgeDetail = {
  library: {
    id: "library",
    name: "Knowledge",
    description: "",
    modelId: "embedding",
    enabled: true,
    activeVersion: "new",
  },
  versions: [version("new"), version("old")],
};
describe("knowledge document version selection", () => {
  it("keeps an explicitly browsed historical version when a newer version becomes active", () => {
    const view = knowledgeVersionView(detail, "old");
    expect(view.displayedVersion).toBe("old");
    expect(view.active?.id).toBe("new");
  });
  it("falls back to the active version when the browsed version has been cleaned up", () => {
    const view = knowledgeVersionView(
      { ...detail, versions: [version("new"), version("old", "deleted")] },
      "old",
    );
    expect(view.displayedVersion).toBe("new");
    expect(view.visibleVersions.map((item) => item.id)).toEqual(["new"]);
  });
});
