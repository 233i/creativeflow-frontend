"use client";
import { ModelCategoryField } from "@/features/settings/models/model-category-field";
import { ModelProtocolField } from "@/features/settings/models/model-protocol-field";
import { useModelForm } from "@/features/settings/models/use-model-form";
import { ModelCapabilities } from "../models/model-capabilities";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type AiModel, type AiProvider } from "@/features/ai/types";
import { FormField } from "@/features/settings/panels/panel-shell";

/** “不覆盖”的哨兵值；react-aria 选择器键必须是非空字符串。 */

/**
 * 创建或编辑模型。
 *
 * 协议字段最为关键：通常保持“继承”，只有提供多种协议的聚合商才需要覆盖。
 * 选项会筛选为真正支持所选分类的协议，例如 `openai-images` 不能服务聊天。
 */
export function ModelFormDialog({
  isOpen,
  onOpenChange,
  provider,
  model,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  provider: AiProvider;
  /** 空值表示创建新模型。 */
  model: AiModel | null;
}) {
  const controller = useModelForm({ isOpen, onOpenChange, provider, model });
  const { t, modelKey, setModelKey, name, setName, busy, error, isNew, save } = controller;
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="w-[min(32rem,calc(100vw-2rem))] max-w-none sm:max-w-none"
    >
      <DialogHeader>
        <DialogTitle>{isNew ? t("provider.addModel") : t("common.edit")}</DialogTitle>
        <DialogDescription>{provider.name}</DialogDescription>
      </DialogHeader>

      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
        <FormField label={t("model.id")} hint={t("model.idHint")}>
          <Input
            value={modelKey}
            onChange={(event) => setModelKey(event.target.value)}
            // 该键会发送给上游；修改现有模型的键会静默地重新指向所有引用它的节点。
            disabled={!isNew}
            placeholder="gpt-image-1"
            aria-label={t("model.id")}
            className="font-mono text-xs"
          />
        </FormField>

        <FormField label={t("model.name")}>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={modelKey || "GPT Image 1"}
            aria-label={t("model.name")}
          />
        </FormField>

        <ModelCategoryField controller={controller} />

        <ModelProtocolField controller={controller} />

        <ModelCapabilities controller={controller} />

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" onPress={() => onOpenChange(false)}>
          {t("common.cancel")}
        </Button>
        <Button size="sm" isDisabled={!modelKey.trim() || busy} onPress={() => void save()}>
          {t("common.save")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
