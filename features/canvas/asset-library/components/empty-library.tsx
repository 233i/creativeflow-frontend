"use client";
import { useT } from "@/components/providers/i18n-provider";
import { ImageIcon } from "lucide-react";
export function EmptyLibrary() {
  const t = useT();
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
      <ImageIcon className="size-6 text-muted-foreground" aria-hidden />
      <p className="text-sm">{t("canvas.assetLibraryEmpty")}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{t("canvas.assetLibraryEmptyHint")}</p>
    </div>
  );
}
