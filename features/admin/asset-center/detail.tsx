"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "../detail-drawer";
import type { AssetItem, AssetActionKind } from "@/features/assets/types";
import { useAssetDetail } from "./controllers/use-asset-detail";
import { AssetDetailActions } from "./components/detail-actions";
import { AssetDetailContent } from "./components/detail-content";

type Props = {
  id: string;
  revision: number;
  onClose: () => void;
  onChanged: (message: string) => void;
  onAction: (asset: AssetItem, action: AssetActionKind) => void;
  onSelect: (id: string) => void;
};
export function AssetDetailDrawer(props: Props) {
  return <DetailSession key={props.id} {...props} />;
}
function DetailSession({ id, revision, onClose, onChanged, onAction, onSelect }: Props) {
  const [tab, setTab] = useState("info");
  const controller = useAssetDetail(id, revision, onChanged, onSelect);
  const { detail, error, notice, refresh } = controller;
  return (
    <DetailDrawer
      title="资产详情"
      onClose={onClose}
      actions={detail && <AssetDetailActions asset={detail.asset} onAction={onAction} />}
    >
      {error && (
        <div role="alert" className="mb-3 space-y-2 text-sm text-destructive">
          <p>{error}</p>
          <Button size="sm" variant="outline" onPress={refresh}>
            重新查询
          </Button>
        </div>
      )}
      {notice && (
        <p role="status" className="mb-2 text-xs text-primary">
          {notice}
        </p>
      )}
      {!detail && !error && <p role="status">正在读取资产…</p>}
      {detail && (
        <AssetDetailContent
          detail={detail}
          controller={controller}
          onSelect={onSelect}
          tab={tab}
          setTab={setTab}
        />
      )}
    </DetailDrawer>
  );
}
