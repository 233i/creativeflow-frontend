"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MODEL_CATEGORIES, type ModelCategory, PROTOCOLS_BY_CATEGORY } from "@/features/ai/types";
import { INHERIT } from "@/features/settings/models/model-form-options";
import type { ModelFormDialogController } from "@/features/settings/models/use-model-form";
import { FormField } from "@/features/settings/panels/panel-shell";
export function ModelCategoryField({ controller }: { controller: ModelFormDialogController }) {
  const { t, category, setCategory, type, setType } = controller;
  return (
    <FormField label={t("model.category")}>
      <Select
        aria-label={t("model.category")}
        selectedKey={category}
        onSelectionChange={(key) => {
          const next = String(key) as ModelCategory;
          setCategory(next);
          // 新分类不支持的协议覆盖会被服务器拒绝；应回退到继承，
          // 而不是让用户提交无效组合。
          if (type !== INHERIT && !PROTOCOLS_BY_CATEGORY[next].includes(type)) {
            setType(INHERIT);
          }
        }}
        className="w-full"
      >
        <SelectTrigger aria-label={t("model.category")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MODEL_CATEGORIES.map((value) => (
            <SelectItem key={value} id={value}>
              {t(
                `model.category${value.charAt(0).toUpperCase()}${value.slice(1)}` as Parameters<
                  typeof t
                >[0],
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}
