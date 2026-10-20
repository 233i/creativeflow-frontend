"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ProviderType } from "@/features/ai/types";
import { INHERIT } from "@/features/settings/models/model-form-options";
import type { ModelFormDialogController } from "@/features/settings/models/use-model-form";
import { FormField } from "@/features/settings/panels/panel-shell";
export function ModelProtocolField({ controller }: { controller: ModelFormDialogController }) {
  const { t, type, setType, inheritedProtocol, allowedProtocols } = controller;
  return (
    <FormField
      label={t("model.protocolOverride")}
      hint={
        (type === INHERIT ? inheritedProtocol : type) === "minimax-h3"
          ? t("model.minimaxH3NativeHint")
          : t("model.protocolOverrideHint")
      }
    >
      <Select
        aria-label={t("model.protocolOverride")}
        selectedKey={type}
        onSelectionChange={(key) => setType(String(key) as ProviderType | typeof INHERIT)}
        className="w-full"
      >
        <SelectTrigger aria-label={t("model.protocolOverride")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem id={INHERIT}>
            {t("model.protocolInherit", { type: inheritedProtocol })}
          </SelectItem>
          {allowedProtocols.map((value) => (
            <SelectItem key={value} id={value}>
              {value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}
