import type { AssetOrigin } from "./types";

export const sourceLabel = (value: string) =>
  ({
    upload: "本地上传",
    generated: "模型生成",
    derived: "派生素材",
    reused: "公共素材复用",
    public: "公共素材",
    unknown: "历史来源未知",
  })[value] ?? value;
export const stateLabel = (value: string) =>
  ({ active: "有效", recycled: "回收站", cleaning: "清理待完成", purged: "原件已清理" })[value] ??
  value;
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[index]}`;
}
export function sourceLink(origin: AssetOrigin) {
  if (origin.kind === "workflow" && origin.workflowId)
    return `/admin/workflows/${encodeURIComponent(origin.workflowId)}/runs?inspectRun=${encodeURIComponent(origin.id)}${origin.nodeId ? `&inspectNode=${encodeURIComponent(origin.nodeId)}` : ""}`;
  if (origin.kind === "canvas")
    return `/admin/runs?recordSource=canvas&requestId=${encodeURIComponent(origin.id)}`;
  return null;
}

export const actionNames = {
  recycle: "移入回收站",
  restore: "恢复资产",
  purge: "永久清理原件",
  publish: "发布到公共素材",
  unpublish: "下架公共素材",
} satisfies Record<import("./types").AssetActionKind, string>;
export const batchNames = {
  purge: "批量安全清理",
  recycle: "批量移入回收站",
  restore: "批量恢复",
  group: "移动文件夹",
  tags: "添加标签",
} satisfies Record<import("./types").AssetBatchKind, string>;

export const auditLabels: Record<string, string> = {
  update: "编辑资料",
  tags: "修改标签",
  group: "整理文件夹",
  recycle: "移入回收站",
  restore: "恢复",
  publish: "发布公共素材",
  unpublish: "下架公共素材",
  reuse: "复用公共素材",
  "purge-requested": "申请清理",
  "purge-history-requested": "确认清理历史原件",
  purged: "原件已清理",
};
