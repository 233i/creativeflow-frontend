"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import type { PublicationController } from "../controllers/use-publication-controller";
import { PublicationSecret } from "./publication-secret";
export function PublicationKeyDialog({ controller }: { controller: PublicationController }) {
  const {
    page,
    keyName,
    setKeyName,
    newSecret,
    action,
    error,
    keyDialog,
    createKey,
    closeKeyDialog,
    current,
  } = controller;
  const secretPreview = controller.newSecret && <PublicationSecret controller={controller} />;
  return (
    <Dialog
      isOpen={!!page && keyDialog}
      onOpenChange={closeKeyDialog}
      isDismissable={action === null}
      showCloseButton={action === null}
      className="sm:max-w-md"
      aria-label="签发 API 凭证"
    >
      <DialogHeader>
        <DialogTitle>签发 API 凭证</DialogTitle>
        <DialogDescription>
          仅签发此工作流的调用凭证，不会自动授予知识库或外部接口权限。
        </DialogDescription>
      </DialogHeader>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {secretPreview || (
        <label className="mt-4 grid gap-2 text-sm">
          凭证名称
          <Input
            autoFocus
            disabled={action !== null}
            value={keyName}
            maxLength={100}
            onChange={(event) => setKeyName(event.target.value)}
          />
        </label>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button
          variant="outline"
          isDisabled={action !== null}
          onPress={() => closeKeyDialog(false)}
        >
          {newSecret ? "关闭" : "取消"}
        </Button>
        {!newSecret && (
          <Button
            isDisabled={!current || action !== null || !keyName.trim()}
            onPress={() => void createKey()}
          >
            {action === "key" && <Loader2 className="size-4 animate-spin" />}确认签发
          </Button>
        )}
      </div>
    </Dialog>
  );
}
