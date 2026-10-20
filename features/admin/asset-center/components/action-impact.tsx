"use client";
import type { AssetActionKind, AssetDeletionPreview } from "@/features/assets/types";
export function AssetActionImpact({
  action,
  preview,
}: {
  action: AssetActionKind;
  preview: AssetDeletionPreview;
}) {
  return (
    <>
      <p className="rounded-lg bg-muted p-3">
        {action === "publish"
          ? "发布后，拥有有效会话的素材库用户可查看和复用图片或视频。提示词、生成参数和原账户信息不会公开。已复用的副本不会因下架而删除，请确认拥有分享权。"
          : action === "purge"
            ? "永久清理不可撤销。保留资产记录和审计，不再提供此资产原件；共享存储字节仅在最后一个引用释放后清理。"
            : action === "recycle"
              ? "从素材选择器隐藏，可恢复。已有历史原件暂时保留；含此资产的新运行会被阻止，恢复后可继续使用。"
              : action === "unpublish"
                ? "停止新的公共访问与复用，已经复用的独立资产仍保留。"
                : "恢复后重新出现在素材选择器中，不会调用模型。"}
      </p>
      {(action === "purge" || action === "recycle") && (
        <div className="space-y-2 rounded-lg border p-3">
          <p className="font-medium">引用检查 · {preview.references.length} 处</p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
            {preview.references.map((r, i) => (
              <li key={i}>
                {r.protection === "active"
                  ? "运行中"
                  : r.protection === "protected"
                    ? "受保护"
                    : "历史记录"}{" "}
                · {r.name}
              </li>
            ))}
          </ul>
          {preview.references.length === 0 && (
            <p className="text-muted-foreground">未发现当前资源或历史引用。</p>
          )}
          {action === "purge" && (
            <>
              <p>
                回收站保留 {preview.retentionDays} 天
                {preview.eligibleAt
                  ? `，可检查清理时间：${new Date(preview.eligibleAt).toLocaleString()}`
                  : ""}
                。
              </p>
              {preview.blockers.map((s) => (
                <p key={s} className="text-amber-700">
                  {s}
                </p>
              ))}
            </>
          )}
          {action === "recycle" && !preview.canRecycle && (
            <p className="text-destructive">公共素材须先下架；运行中的任务须先完成或取消。</p>
          )}
        </div>
      )}
    </>
  );
}
