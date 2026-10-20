"use client";

import { useRef, useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { AiApiError, type UpdateProviderInput } from "@/features/ai/api";
import { useAiStore } from "@/features/ai/store";

/** 普通保存和开关操作在详情内反馈失败；删除确认仍由 ConfirmDialog 接管。 */
export function useProviderCommands(providerId: string) {
  const t = useT();
  const persistProvider = useAiStore((state) => state.updateProvider);
  const persistModel = useAiStore((state) => state.updateModel);
  const persistModelStates = useAiStore((state) => state.setAllModelsEnabled);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef(false);

  async function attempt(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
      return true;
    } catch (reason) {
      setError(
        reason instanceof AiApiError
          ? (reason.details[0] ?? reason.message)
          : reason instanceof Error
            ? reason.message
            : t("errors.networkError"),
      );
      return false;
    }
  }

  async function saveProvider(input: UpdateProviderInput) {
    if (saveRef.current) return false;
    saveRef.current = true;
    setSaving(true);
    try {
      return await attempt(() => persistProvider(providerId, input));
    } finally {
      saveRef.current = false;
      setSaving(false);
    }
  }

  return {
    saving,
    error,
    saveProvider,
    updateProvider: (...args: Parameters<typeof persistProvider>) =>
      attempt(() => persistProvider(...args)),
    updateModel: (...args: Parameters<typeof persistModel>) => attempt(() => persistModel(...args)),
    setAllModelsEnabled: (...args: Parameters<typeof persistModelStates>) =>
      attempt(() => persistModelStates(...args)),
  };
}
