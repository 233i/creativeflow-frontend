import type { AssetDetail, AssetItem } from "./types";

export function assetFixture(values: Partial<AssetItem> = {}): AssetItem {
  return {
    id: "asset-a",
    name: "Asset A",
    kind: "image",
    mediaType: "image/png",
    byteSize: 128,
    source: "upload",
    state: "active",
    accountId: null,
    owner: "Owner",
    groupId: null,
    groupName: null,
    tags: [],
    createdAt: "2026-09-28T00:00:00Z",
    deletedAt: null,
    purgedAt: null,
    isPublic: false,
    referenceCount: 0,
    width: 100,
    height: 100,
    duration: null,
    revision: "3",
    url: "/asset-a",
    thumbnailUrl: "/asset-a/thumbnail",
    canManage: true,
    ...values,
  };
}
export function detailFixture(asset = assetFixture()): AssetDetail {
  return {
    asset,
    prompt: null,
    sha256: null,
    references: [],
    origins: [],
    audit: [],
    referencesComplete: true,
  };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, failed) => {
    resolve = done;
    reject = failed;
  });
  return { promise, resolve, reject };
}
