"use client";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { ImagePlus, Loader2, X } from "lucide-react";
import { MAX_AGENT_IMAGES } from "../controllers/use-agent-attachments";
import type { AgentPanelController } from "../controllers/use-agent-panel";
export function AgentAttachments({ controller }: { controller: AgentPanelController }) {
  const {
    t,
    attachments,
    attachmentError,
    selected,
    imageInputRef,
    canAttachImages,
    uploading,
    removeAttachment,
  } = controller;
  return (
    <>
      {" "}
      {attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2">
          {attachments.map((image) => (
            <div
              key={image.id}
              className="group relative size-12 overflow-hidden rounded-md border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={image.name} className="size-full object-cover" />
              <TooltipTrigger>
                <Button
                  size="icon-xs"
                  variant="destructive"
                  className="absolute top-0.5 right-0.5 size-4 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  onPress={() => removeAttachment(image.id)}
                  aria-label={t("agent.removeImage")}
                >
                  <X className="size-2.5" aria-hidden />
                </Button>
                <Tooltip>{t("agent.removeImage")}</Tooltip>
              </TooltipTrigger>
            </div>
          ))}
        </div>
      )}
      {(attachmentError || attachments.length > 0 || selected) && (
        <div className="mt-2 flex min-h-7 items-center justify-between gap-2">
          <div className="min-w-0 text-[0.625rem] text-muted-foreground">
            {attachmentError ? (
              <span className="text-destructive">{attachmentError}</span>
            ) : selected?.supportsVision ? (
              <span>{t("agent.imageSupportHint")}</span>
            ) : attachments.length > 0 ? (
              <span className="text-amber-600">{t("agent.imageUnsupported")}</span>
            ) : null}
          </div>
          <Button
            size="xs"
            variant="ghost"
            onPress={() => imageInputRef.current?.click()}
            isDisabled={!canAttachImages || uploading || attachments.length >= MAX_AGENT_IMAGES}
          >
            {uploading ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="size-3.5" aria-hidden />
            )}
            {t("agent.attachImage")}
          </Button>
        </div>
      )}
    </>
  );
}
