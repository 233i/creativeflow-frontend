export type AssetState = "active" | "recycled" | "cleaning" | "purged";
export interface AssetItem {
  id: string;
  name: string;
  kind: "image" | "video";
  mediaType: string;
  byteSize: number;
  source: string;
  state: AssetState;
  accountId: string | null;
  owner: string;
  groupId: string | null;
  groupName: string | null;
  tags: string[];
  createdAt: string;
  deletedAt: string | null;
  purgedAt: string | null;
  isPublic: boolean;
  referenceCount: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  revision: string;
  url: string;
  thumbnailUrl: string;
  canManage: boolean;
}
export interface AssetPage {
  items: AssetItem[];
  total: number;
  offset: number;
  limit: number;
}
export interface AssetQuery {
  search?: string;
  kind?: string;
  source?: string;
  accountId?: string;
  groupId?: string;
  ungrouped?: boolean;
  tag?: string;
  state?: string;
  usage?: string;
  from?: string;
  to?: string;
  minBytes?: number;
  sort?: string;
  offset?: number;
  limit?: number;
  public?: boolean;
}
export interface AssetReference {
  kind: string;
  id: string;
  slot: string;
  name: string;
  protection: "active" | "protected" | "history";
  workflowId: string | null;
  runId: string | null;
  nodeId: string | null;
}
export interface AssetOrigin {
  kind: string;
  id: string;
  workflowId: string | null;
  nodeId: string | null;
  model: string | null;
  provider: string | null;
  parametersJson: string | null;
  sourceAssetId: string | null;
}
export interface AssetDetail {
  asset: AssetItem;
  prompt: string | null;
  sha256: string | null;
  references: AssetReference[];
  origins: AssetOrigin[];
  audit: { action: string; actor: string; reason: string; createdAt: string }[];
  referencesComplete: boolean;
}
export interface AssetDeletionPreview {
  asset: AssetItem;
  references: AssetReference[];
  canRecycle: boolean;
  canPurge: boolean;
  canPurgeHistory: boolean;
  eligibleAt: string | null;
  blockers: string[];
  retentionDays: number;
}
export interface AssetAction {
  revision: string;
  reason: string;
  confirmName?: string;
  allowHistory?: boolean;
}
export type AssetActionKind = "recycle" | "restore" | "purge" | "publish" | "unpublish";
export type AssetBatchKind = "recycle" | "restore" | "purge" | "group" | "tags";
export interface AssetResult {
  id: string;
  status: string;
  message: string;
  logicalBytes: number;
}
interface AssetBatchBase {
  ids: string[];
  reason: string;
  revisions: Record<string, string>;
}
export type AssetBatch = AssetBatchBase &
  (
    | { action: "recycle" | "restore" | "purge" }
    | { action: "group"; groupName: string }
    | { action: "tags"; tags: string[] }
  );
export interface AssetPolicy {
  retentionDays: number;
  warningBytes: number;
  accountWarningBytes: number;
}
export interface StorageBucket {
  key: string;
  count: number;
  bytes: number;
}
export interface AssetStorage {
  activeBytes: number;
  recycleBytes: number;
  storedBytes: number;
  previewBytes: number;
  purgeableBytes: number;
  purgedBytes: number;
  byKind: StorageBucket[];
  byOwner: StorageBucket[];
  bySource: StorageBucket[];
  policy: AssetPolicy;
  warning: boolean;
}
export interface AssetFacets {
  groups: { id: string; name: string; count: number }[];
  owners: { id: string; name: string; count: number }[];
  tags: string[];
}
