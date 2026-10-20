"use client";

import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const CENTER_COLUMNS = [
  ["name", "名称", 210],
  ["kind", "类型", 96],
  ["channels", "发布渠道", 174],
  ["draft", "草稿", 110],
  ["run", "最近运行", 110],
  ["updatedAt", "更新时间", 160],
  ["source", "来源", 108],
  ["nodeCount", "节点数", 64],
  ["actions", "操作", 208],
] as const;
export function columnWidths(value: string): Record<string, number> {
  let saved: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      saved = parsed as Record<string, unknown>;
  } catch {
    /* 损坏的个人偏好回退为默认列宽。 */
  }
  return Object.fromEntries(
    CENTER_COLUMNS.map(([key, , initial]) => [
      key,
      typeof saved[key] === "number" && Number.isFinite(saved[key])
        ? Math.max(initial, Math.min(640, Math.round(saved[key] as number)))
        : initial,
    ]),
  );
}

/** 仅修改个人可见列，列宽统一通过表头拖拽调整。 */
export function ColumnSettings({
  visible,
  onToggle,
  onReset,
  onClose,
}: {
  visible: Set<string>;
  onToggle: (key: string) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className="sm:max-w-md"
    >
      <DialogHeader>
        <DialogTitle>设置显示列</DialogTitle>
        <DialogDescription>
          列宽直接拖动表头边界调整；这里仅控制可选列的显示。布局立即保存到本机。
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <p className="text-xs text-muted-foreground">
          固定列：名称、类型、发布渠道、草稿、最近运行、操作
        </p>
        {CENTER_COLUMNS.filter(([key]) => ["updatedAt", "source", "nodeCount"].includes(key)).map(
          ([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={visible.has(key)} onChange={() => onToggle(key)} />
              {label}
            </label>
          ),
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onPress={onReset}>
          恢复默认
        </Button>
        <Button onPress={onClose}>完成</Button>
      </div>
    </Dialog>
  );
}
