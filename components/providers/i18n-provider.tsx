"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";
import { en } from "@/lib/i18n/dictionaries/en";
import { type Dictionary, zh } from "@/lib/i18n/dictionaries/zh";

const DICTIONARIES: Record<Locale, Dictionary> = { zh, en };

const STORAGE_KEY = "sol.locale";

/** 以点分隔的字典路径，例如 `"provider.apiKey"`。 */
type Path<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Path<T[K]>}`;
}[keyof T & string];

export type TranslationKey = Path<Dictionary>;

export type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function lookup(dictionary: Dictionary, key: string): string | undefined {
  const value = key
    .split(".")
    .reduce<unknown>(
      (node, segment) =>
        typeof node === "object" && node !== null
          ? (node as Record<string, unknown>)[segment]
          : undefined,
      dictionary,
    );

  return typeof value === "string" ? value : undefined;
}

function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

/**
 * 将已存储语言区域读取为外部存储。
 *
 * 使用 `useSyncExternalStore` 而不是 `useState` 加副作用，因为服务器和客户端的语言区域确实不同：
 * 服务器没有 localStorage。`getServerSnapshot` 参数正是为此而设；React 先用服务器值完成水合，
 * 再使用客户端值重新渲染，而不会抛出水合不匹配。
 *
 * 旧版本直接使用 localStorage 初始化 `useState`。这会在首次客户端渲染，也就是水合期间读取存储值，
 * 因此当用户偏好不是默认值时，服务器渲染页面的翻译会与客户端不匹配。
 *
 * 与 `components/layout/theme-toggle.tsx` 中的 `useMounted` 辅助函数保持一致。
 */
const localeStore = {
  listeners: new Set<() => void>(),

  subscribe(listener: () => void) {
    localeStore.listeners.add(listener);
    // 其他标签页更改偏好时也应传播到这里。
    window.addEventListener("storage", listener);

    return () => {
      localeStore.listeners.delete(listener);
      window.removeEventListener("storage", listener);
    };
  },

  getSnapshot(): Locale {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  },

  getServerSnapshot(): Locale {
    return DEFAULT_LOCALE;
  },

  set(locale: Locale) {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    localeStore.listeners.forEach((listener) => listener());
  },
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    localeStore.subscribe,
    localeStore.getSnapshot,
    localeStore.getServerSnapshot,
  );

  const setLocale = useCallback((next: Locale) => localeStore.set(next), []);

  const t = useCallback<Translate>(
    (key, values) => {
      const template = lookup(DICTIONARIES[locale], key) ?? lookup(zh, key) ?? key;
      return interpolate(template, values);
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}

/** 供只需要翻译函数的组件使用的便捷 Hook。 */
export function useT(): Translate {
  return useI18n().t;
}
