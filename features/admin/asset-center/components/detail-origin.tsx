"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { sourceLink } from "@/features/assets/presentation";
import type { AssetDetail } from "@/features/assets/types";
export function AssetDetailOrigins({
  detail,
  copy,
  onSelect,
}: {
  detail: AssetDetail;
  copy: (value: string) => Promise<void>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {detail.prompt && (
        <div>
          <h3 className="mb-1 font-medium">提示词</h3>
          <p className="max-h-52 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-3">
            {detail.prompt}
          </p>
          <Button size="xs" variant="link" onPress={() => void copy(detail.prompt!)}>
            复制提示词
          </Button>
        </div>
      )}
      {detail.origins.length === 0 && (
        <p className="text-muted-foreground">
          没有可证实的生成任务记录。历史数据不会推测填充来源。
        </p>
      )}
      {detail.origins.map((o, i) => (
        <div key={i} className="space-y-2 rounded-lg border p-3">
          <p className="font-medium">
            {o.kind === "derived" ? "来源素材" : o.kind === "workflow" ? "工作流运行" : "生成任务"}
            {o.model ? ` · ${o.model}` : ""}
          </p>
          <p className="break-all text-xs text-muted-foreground">
            {o.provider}
            {o.nodeId ? ` · 节点 ${o.nodeId}` : ""} · {o.id}
          </p>
          {o.sourceAssetId && (
            <button className="text-primary" onClick={() => onSelect(o.sourceAssetId!)}>
              查看来源资产
            </button>
          )}
          {sourceLink(o) && (
            <Link href={sourceLink(o)!} className="text-primary">
              查看运行记录
            </Link>
          )}
          {o.parametersJson && (
            <>
              <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">
                {JSON.stringify(JSON.parse(o.parametersJson), null, 2)}
              </pre>
              <Button size="xs" variant="outline" onPress={() => void copy(o.parametersJson!)}>
                复制生成参数
              </Button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
