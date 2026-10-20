"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AssetActionKind, AssetItem } from "@/features/assets/types";
import { actionNames } from "@/features/assets/presentation";
import { useAssetAction } from "./controllers/use-asset-action";
import { AssetActionImpact } from "./components/action-impact";
import { AssetActionFields } from "./components/action-fields";
export { actionNames } from "@/features/assets/presentation";

type Props = {
  asset: AssetItem;
  action: AssetActionKind;
  onClose: () => void;
  onDone: (message: string) => void;
};
export function AssetActionDialog(props: Props) {
  return <ActionDialog key={`${props.asset.id}:${props.action}`} {...props} />;
}
function ActionDialog({ asset, action, onClose, onDone }: Props) {
  const controller = useAssetAction(asset, action, onDone);
  const { preview, error, busy, ready, refresh, submit } = controller;
  return (
    <Dialog
      isOpen
      aria-label={actionNames[action]}
      isDismissable={!busy}
      showCloseButton={!busy}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      className="sm:max-w-xl"
    >
      <DialogHeader>
        <DialogTitle>{actionNames[action]}</DialogTitle>
        <DialogDescription>{asset.name}</DialogDescription>
      </DialogHeader>
      <div className="max-h-[55dvh] space-y-4 overflow-y-auto text-sm">
        {!preview && !error && <p role="status">正在核对任务、草稿、发布版本与历史引用…</p>}
        {error && (
          <div role="alert" className="rounded-lg bg-destructive/5 p-3 text-destructive">
            <p>{error}</p>
            <Button size="sm" variant="outline" isDisabled={busy} onPress={refresh}>
              重新查询
            </Button>
          </div>
        )}
        {preview && (
          <>
            <AssetActionImpact action={action} preview={preview} />
            <AssetActionFields action={action} controller={controller} />
          </>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" isDisabled={busy} onPress={onClose}>
          取消
        </Button>
        <Button
          variant={action === "purge" ? "destructive" : "default"}
          isDisabled={busy || !ready}
          onPress={() => void submit()}
        >
          {busy ? "处理中…" : actionNames[action]}
        </Button>
      </div>
    </Dialog>
  );
}
