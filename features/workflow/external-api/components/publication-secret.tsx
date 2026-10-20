"use client";
import { Button } from "@/components/ui/button";
import { Check, Clipboard } from "lucide-react";
import type { PublicationController } from "../controllers/use-publication-controller";

export function PublicationSecret({ controller }: { controller: PublicationController }) {
  const { newSecret, copied, copy } = controller;

  return (
    newSecret && (
      <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
        <p className="text-xs font-medium">请立即复制，关闭后将不再显示完整 Key</p>
        <div className="mt-2 flex gap-2">
          <code className="min-w-0 flex-1 select-all overflow-x-auto rounded bg-background px-2 py-1.5 text-xs">
            {newSecret}
          </code>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="复制完整 Key"
            onPress={() => void copy(newSecret)}
          >
            {copied ? <Check className="size-3.5" /> : <Clipboard className="size-3.5" />}
          </Button>
        </div>
      </div>
    )
  );
}
