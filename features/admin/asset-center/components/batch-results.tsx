"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AssetResult } from "@/features/assets/types";

export function AssetBatchResults({
  results,
  onClose,
}: {
  results: AssetResult[];
  onClose: () => void;
}) {
  return (
    <Dialog
      isOpen
      aria-label="批量操作结果"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogHeader>
        <DialogTitle>批量操作结果</DialogTitle>
        <DialogDescription>成功项不会重复提交；失败项请核对原因后重新选择。</DialogDescription>
      </DialogHeader>
      <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
        {results.map((r) => (
          <li key={r.id} className="rounded border p-2">
            <code className="text-xs">{r.id}</code>
            <p>{r.message}</p>
          </li>
        ))}
      </ul>
      <Button onPress={() => onClose()}>完成</Button>
    </Dialog>
  );
}
