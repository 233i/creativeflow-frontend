"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useI18n, useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/config";
import { type DeviceIdentity, handshake, storedDeviceId } from "@/lib/device";
import { PanelBody, PanelHeader, PanelSection } from "@/features/settings/panels/panel-shell";
import { ThemePicker } from "@/features/settings/theme-picker";

/**
 * 常规设置：外观、语言以及此配置绑定的设备身份。
 *
 * 设备部分不是装饰。没有账户时，设备身份本身就是账户；它决定用户能访问哪些供应商和画布，
 * 因此必须放在可见位置，并说明清除浏览器存储的后果。
 */
export function GeneralPanel() {
  const t = useT();
  const { locale, setLocale } = useI18n();

  const [identity, setIdentity] = useState<DeviceIdentity | null>(null);
  const [resolving, setResolving] = useState(false);

  // 挂载时通过惰性初始状态读取一次。设置打开期间这些值不会变化，使用副作用只会增加一次渲染。
  const [signals] = useState(collectDisplaySignals);

  const resolve = useCallback(async () => {
    setResolving(true);
    try {
      setIdentity(await handshake());
    } catch {
      setIdentity(null);
    } finally {
      setResolving(false);
    }
  }, []);

  // 报告浏览器已持有的身份。打开设置不能创建身份；握手是下方按钮触发的显式操作。
  //
  // 此处不做同步状态更新：首次更新发生在 await 之后，
  // cancelled 标志会阻止延迟响应写入已卸载面板。
  useEffect(() => {
    if (!storedDeviceId()) return;

    let cancelled = false;

    void (async () => {
      try {
        const resolved = await handshake();
        if (!cancelled) setIdentity(resolved);
      } catch {
        if (!cancelled) setIdentity(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const methodLabel = identity
    ? identity.method === "Deterministic"
      ? t("general.methodDeterministic")
      : identity.method === "ProbabilisticCoarse"
        ? t("general.methodProbabilistic")
        : t("general.methodManual")
    : null;

  return (
    <>
      <PanelHeader title={t("settings.nav.general")} />

      <PanelBody>
        <PanelSection title={t("general.appearance")}>
          <ThemePicker />

          <Field label={t("general.language")}>
            <Select
              aria-label={t("general.language")}
              selectedKey={locale}
              onSelectionChange={(key) => setLocale(String(key) as Locale)}
              className="w-48"
            >
              <SelectTrigger aria-label={t("general.language")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((value) => (
                  <SelectItem key={value} id={value}>
                    {LOCALE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </PanelSection>

        <PanelSection title={t("general.device")} description={t("general.deviceDescription")}>
          {identity ? (
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
              <Row label={t("general.deviceId")} value={identity.deviceId} mono />
              <Row label={t("general.visitorId")} value={identity.visitorId} mono />
              <Row label={t("general.method")} value={methodLabel ?? ""} />
              <Row label={t("general.confidence")} value={identity.confidence.toFixed(2)} />
            </dl>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">{t("general.deviceNotResolved")}</p>
              <Button
                variant="outline"
                size="sm"
                onPress={() => void resolve()}
                isDisabled={resolving}
              >
                {resolving && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                {t("general.resolveDevice")}
              </Button>
            </div>
          )}

          <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <ShieldAlert
              className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500"
              aria-hidden
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("general.securityNotice")}
            </p>
          </div>
        </PanelSection>

        {signals.length > 0 && (
          <PanelSection title={t("general.signals")}>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
              {signals.map(([key, value]) => (
                <Row key={key} label={t(key as Parameters<typeof t>[0])} value={value} />
              ))}
            </dl>
          </PanelSection>
        )}
      </PanelBody>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-xs break-all" : "break-words"}>{value}</dd>
    </>
  );
}

/**
 * 读取握手发送的不依赖浏览器信号。
 *
 * 显示这些内容，使被采集指纹的人能看到采集行为，而不是静默进行；
 * `docs/device-identification.md` 指出 PIPL、GDPR 和 CCPA 都将其视为个人数据。
 * 刻意排除易变的高熵信号：这里只负责披露，不是第二个采集点。
 */
function collectDisplaySignals(): Array<[string, string]> {
  if (typeof window === "undefined") return [];

  const nav = navigator as Navigator & { deviceMemory?: number };
  const entries: Array<[string, string]> = [];

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timeZone) entries.push(["general.timeZone", timeZone]);
  if (nav.platform) entries.push(["general.platform", nav.platform]);
  if (nav.hardwareConcurrency) {
    entries.push(["general.cpuCores", String(nav.hardwareConcurrency)]);
  }
  if (nav.deviceMemory) entries.push(["general.memory", `${nav.deviceMemory} GB`]);
  if (window.screen) {
    entries.push([
      "general.screen",
      `${window.screen.width}×${window.screen.height} @${window.devicePixelRatio}x`,
    ]);
  }
  if (navigator.language) entries.push(["general.primaryLanguage", navigator.language]);

  return entries;
}
