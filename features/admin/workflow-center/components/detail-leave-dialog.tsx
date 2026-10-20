"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { WorkflowDetailController } from "../controllers/use-workflow-detail";
export function DetailLeaveDialog({ controller }: { controller: WorkflowDetailController }) {
  const {
    session,
    pending,
    setPending,
    leaving,
    formDirty,
    setFormDirty,
    formBusy,
    formCanSave,
    saveAndProceed,
  } = controller;
  return (
    <Dialog
      isOpen={!!pending}
      onOpenChange={(open) => {
        if (!open && !leaving) setPending(null);
      }}
      isDismissable={!leaving}
      showCloseButton={!leaving}
    >
      <DialogHeader>
        <DialogTitle>处理未保存修改</DialogTitle>
        <DialogDescription>
          {formBusy
            ? "操作已提交，离开不会撤回请求，稍后需要重新查询结果。"
            : formDirty && !formCanSave
              ? "发布参数尚未确认或有一次性凭证未收起。离开将放弃输入并清除凭证；不会替你自动发布。"
              : "离开后未保存的修改会丢失。"}
          已经提交的运行会继续执行，不会因离开而取消。
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" isDisabled={leaving} onPress={() => setPending(null)}>
          继续编辑
        </Button>
        <Button
          variant="outline"
          isDisabled={leaving}
          onPress={() => {
            setFormDirty(false);
            const next = pending;
            setPending(null);
            next?.();
          }}
        >
          放弃修改并离开
        </Button>
        {(!formDirty || formCanSave) && (
          <Button
            isDisabled={leaving || session?.busy || formBusy}
            onPress={() => void saveAndProceed()}
          >
            {leaving ? "保存中…" : "保存后离开"}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
