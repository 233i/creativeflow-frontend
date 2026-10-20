/**
 * 最小化国际化实现：类型化字典加上下文 Hook，不依赖框架。
 *
 * `next-intl` 等库倾向于接管路由（`[locale]` 路径段或中间件）。此应用每页只保留一个 URL，
 * 并在客户端设置中切换语言，因此语言区域是偏好而不是路由，使用字典查询已经足够。
 *
 * `zh` 是事实来源：它先声明，`Dictionary` 由其派生；
 * 因此只向 `zh` 添加键而未同步添加到 `en` 会产生类型错误。
 */

export const LOCALES = ["zh", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "zh";

export const LOCALE_LABELS: Record<Locale, string> = {
  zh: "简体中文",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
