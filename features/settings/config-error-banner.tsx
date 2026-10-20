"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { useAiStore } from "@/features/ai/store";
import { handshake } from "@/lib/device";

/**
 * 展示配置加载失败。
 *
 * 存储一直记录此状态，但过去没有任何界面渲染它。因此 Cookie 被清除的设备只会看到空供应商列表，
 * 却没有解释，用户会理解为“设置被删除”，而不是“此浏览器已无法识别”。
 *
 * 未授权情况可原地恢复：握手具有幂等性，重新运行会再次签发 Cookie，重试即可成功。
 */
export function ConfigErrorBanner() {
  const t = useT();
  const error = useAiStore((state) => state.error);
  const refresh = useAiStore((state) => state.refresh);

  const [recovering, setRecovering] = useState(false);

  if (!error) return null;

  const unauthorized = error === "unauthorized";

  async function recover() {
    setRecovering(true);
    try {
      if (unauthorized) {
        await handshake();
      }
      await refresh();
    } catch {
      // refresh() 会在存储中记录结果，因此无论成功失败，横幅都会更新。
    } finally {
      setRecovering(false);
    }
  }

  return (
    <div className="mx-5 mt-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />

      <div className="min-w-0 flex-1">
        <p className="text-xs text-destructive">
          {unauthorized ? t("errors.unauthorized") : t("errors.networkError")}
        </p>
        {!unauthorized && <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">{error}</p>}
      </div>

      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        isDisabled={recovering}
        onPress={() => void recover()}
      >
        {recovering && <Loader2 className="size-3 animate-spin" aria-hidden />}
        {unauthorized ? t("general.resolveDevice") : t("common.retry")}
      </Button>
    </div>
  );
}
