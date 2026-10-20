"use client";

import { Plug, Settings2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/components/providers/i18n-provider";
import { useAiStore } from "@/features/ai/store";
import { ConfigErrorBanner } from "@/features/settings/config-error-banner";
import { GeneralPanel } from "@/features/settings/panels/general-panel";
import { McpPanel } from "@/features/settings/panels/mcp-panel";
import { SkillsPanel } from "@/features/settings/panels/skills-panel";
import { cn } from "@/lib/utils";

export type SettingsTab = "general" | "mcp" | "skills";

const NAV_GROUPS: ReadonlyArray<{
  labelKey: "settings.navGroups.basic" | "settings.navGroups.extensions";
  items: ReadonlyArray<{
    id: SettingsTab;
    labelKey: "settings.nav.general" | "settings.nav.mcp" | "settings.nav.skills";
    icon: typeof Settings2;
  }>;
}> = [
  {
    labelKey: "settings.navGroups.basic",
    items: [{ id: "general", labelKey: "settings.nav.general", icon: Settings2 }],
  },
  {
    labelKey: "settings.navGroups.extensions",
    items: [
      { id: "mcp", labelKey: "settings.nav.mcp", icon: Plug },
      { id: "skills", labelKey: "settings.nav.skills", icon: Sparkles },
    ],
  },
];

export function SettingsDialog({
  isOpen,
  onOpenChange,
  initialTab = "general",
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: SettingsTab;
}) {
  const t = useT();
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const load = useAiStore((state) => state.load);

  // 配置在对话框首次打开时获取，而不是挂载时获取，因此从不打开设置的用户无需承担该开销。
  useEffect(() => {
    if (isOpen) {
      void load();
    }
  }, [isOpen, load]);

  // 打开时重新同步标签页属于渲染阶段关注点，而不是副作用；
  // 与旧值比较可避免在副作用中设置状态所触发的额外渲染。
  const [lastOpen, setLastOpen] = useState(isOpen);
  if (isOpen !== lastOpen) {
    setLastOpen(isOpen);
    if (isOpen) setTab(initialTab);
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      // 主从布局需要空间：面板自行管理内部滚动，因此对话框使用固定高度框架，而不是不断增长的列。
      className="h-[min(42rem,calc(100dvh-4rem))] w-[min(64rem,calc(100vw-2rem))] max-w-none gap-0 overflow-hidden p-0 sm:max-w-none sm:[&_header]:pr-14"
      aria-label={t("settings.title")}
    >
      <div className="flex h-full min-h-0 max-sm:flex-col">
        <nav
          aria-label={t("settings.title")}
          className="flex w-48 shrink-0 flex-col gap-6 overflow-y-auto border-r bg-background p-4 max-sm:w-full max-sm:flex-row max-sm:items-center max-sm:gap-2 max-sm:overflow-x-auto max-sm:border-r-0 max-sm:border-b max-sm:py-3 max-sm:pr-12"
        >
          <p className="px-2 pb-2 text-lg font-semibold max-sm:hidden">{t("settings.title")}</p>

          {NAV_GROUPS.map((group) => (
            <div key={group.labelKey} className="flex flex-col gap-1 max-sm:flex-row">
              <p className="px-2 pb-2 text-xs font-medium text-muted-foreground max-sm:hidden">
                {t(group.labelKey)}
              </p>

              {group.items.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                      active
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {t(item.labelKey)}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* 放在面板上方，使用户无论位于哪个面板都能看到加载失败说明，而不是只在空面板中显示。 */}
          <ConfigErrorBanner />

          {/* 以标签页为键，使切换面板时重新挂载此包装器并重放入场动画，
              避免新面板在帧中途无过渡地突然出现。 */}
          <div key={tab} className="canvas-fade-in flex min-h-0 flex-1 flex-col">
            {tab === "general" && <GeneralPanel />}
            {tab === "mcp" && <McpPanel />}
            {tab === "skills" && <SkillsPanel />}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
