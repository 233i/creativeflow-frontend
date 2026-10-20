"use client";
import type { AssetDetail } from "@/features/assets/types";
import type { AssetDetailController } from "../controllers/use-asset-detail";
import { AssetDetailPreview } from "./detail-preview";
import { AssetDetailInfo } from "./detail-info";
import { AssetDetailOrigins } from "./detail-origin";
import { AssetDetailReferences } from "./detail-usage";
import { AssetDetailAudit } from "./detail-audit";
export function AssetDetailContent({
  detail,
  controller,
  onSelect,
  tab,
  setTab,
}: {
  detail: AssetDetail;
  controller: AssetDetailController;
  onSelect: (id: string) => void;
  tab: string;
  setTab: (tab: string) => void;
}) {
  const asset = detail.asset;
  return (
    <div className="space-y-4 text-sm">
      <AssetDetailPreview
        asset={asset}
        previewKey={controller.previewKey}
        refresh={controller.refresh}
      />
      <div className="flex gap-1 border-b" role="tablist" aria-label="资产详情分类">
        {[
          ["info", "资料"],
          ["origin", "生成来源"],
          ["usage", `引用 ${asset.referenceCount}`],
          ["audit", "操作记录"],
        ].map(([value, label]) => (
          <button
            role="tab"
            aria-selected={tab === value}
            className={`border-b-2 px-3 py-2 ${tab === value ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            key={value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "info" && <AssetDetailInfo detail={detail} controller={controller} />}
        {tab === "origin" && (
          <AssetDetailOrigins detail={detail} copy={controller.copy} onSelect={onSelect} />
        )}
        {tab === "usage" && <AssetDetailReferences detail={detail} />}
        {tab === "audit" && <AssetDetailAudit detail={detail} />}
      </div>
    </div>
  );
}
