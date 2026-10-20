"use client";

import {
  ArrowLeft,
  ChevronRight,
  KeyRound,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { ADMIN_NAVIGATION, adminTabLabel, type AdminTab } from "@/features/admin/admin-navigation";
import { cn } from "@/lib/utils";
import { useAdminPreference } from "./admin-preferences";

function subscribeMobile(listener: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia("(max-width: 800px)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

interface AdminShellProps {
  activeTab: AdminTab;
  username: string;
  onTabChange: (tab: AdminTab) => void;
  onLogout: () => void;
  notice?: ReactNode;
  compact?: boolean;
  workspace?: boolean;
  breadcrumb?: ReactNode;
  children: ReactNode;
}

/** 后台布局只组合导航与插槽，不请求数据、不拥有页面业务状态。 */
export function AdminShell({
  activeTab,
  username,
  onTabChange,
  onLogout,
  notice,
  children,
  compact = false,
  workspace = false,
  breadcrumb,
}: AdminShellProps) {
  const [sidebar, setSidebar] = useAdminPreference("sidebar", compact ? "collapsed" : "expanded");
  const [density] = useAdminPreference("density", "default");
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobile = useSyncExternalStore(
    subscribeMobile,
    () =>
      typeof window.matchMedia === "function" && window.matchMedia("(max-width: 800px)").matches,
    () => false,
  );
  const opened = mobileOpen && mobile;
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const collapsed = sidebar === "collapsed";
  useEffect(() => {
    if (!opened) return;
    navigationRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function escape(event: KeyboardEvent) {
      if (document.querySelector('[data-slot="dialog-overlay"]')) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        menuButton.current?.focus();
      }
      if (event.key === "Tab") {
        const items = [
          ...(sidebarRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]),a[href]") ??
            []),
        ].filter((item) => item.getClientRects().length);
        const first = items[0],
          last = items.at(-1);
        if (
          first &&
          (!sidebarRef.current?.contains(document.activeElement) ||
            (event.shiftKey && document.activeElement === first))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (last && !event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [opened]);
  function navigate(tab: AdminTab) {
    setMobileOpen(false);
    onTabChange(tab);
  }
  return (
    <div
      className={cn("sol-admin-shell", collapsed && "is-collapsed", opened && "is-mobile-open")}
      data-density={density === "compact" ? "compact" : "default"}
    >
      {opened && (
        <button
          className="sol-admin-nav-backdrop"
          aria-label="关闭导航"
          tabIndex={-1}
          onClick={() => {
            setMobileOpen(false);
            menuButton.current?.focus();
          }}
        />
      )}
      <aside
        ref={sidebarRef}
        id="admin-navigation"
        className="sol-admin-sidebar"
        role={opened ? "dialog" : undefined}
        aria-modal={opened ? true : undefined}
        aria-label={opened ? "管理导航" : undefined}
      >
        <div className="sol-admin-brand">
          <Brand />
          <button
            className="sol-admin-mobile-close"
            aria-label="收起导航"
            onClick={() => {
              setMobileOpen(false);
              menuButton.current?.focus();
            }}
          >
            <X size={18} />
          </button>
        </div>
        <nav ref={navigationRef} aria-label="管理功能" className="sol-admin-navigation">
          {ADMIN_NAVIGATION.map((group) => (
            <div key={group.label} className="sol-admin-nav-group">
              <p className="sol-admin-nav-label">{group.label}</p>
              {group.items.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-current={activeTab === id ? "page" : undefined}
                  aria-label={label}
                  title={collapsed ? label : undefined}
                  className={cn("sol-admin-nav-item", activeTab === id && "is-active")}
                  onClick={() => navigate(id)}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <button
          className="sol-admin-sidebar-toggle sol-admin-nav-item"
          aria-label={collapsed ? "展开侧栏" : "折叠侧栏"}
          aria-expanded={!collapsed}
          onClick={() => setSidebar(collapsed ? "expanded" : "collapsed")}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4 shrink-0" />
          ) : (
            <PanelLeftClose className="size-4 shrink-0" />
          )}
          <span>折叠侧栏</span>
        </button>
        <Link
          href="/"
          className="sol-admin-return"
          aria-label="返回画布"
          title={collapsed ? "返回画布" : undefined}
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden />
          <span>返回画布</span>
        </Link>
      </aside>
      <div className="sol-admin-main" inert={opened}>
        <header className="sol-admin-header">
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <button
              ref={menuButton}
              className="sol-admin-mobile-menu"
              aria-label="展开管理导航"
              aria-expanded={opened}
              aria-controls="admin-navigation"
              onClick={() => setMobileOpen(!opened)}
            >
              <Menu size={18} />
            </button>
            <span className="hidden sm:inline">管理后台</span>
            <ChevronRight className="hidden size-3.5 sm:block" aria-hidden />
            {breadcrumb ?? (
              <span className="truncate text-foreground">{adminTabLabel(activeTab)}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-sm text-muted-foreground">{username}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="修改密码"
              onPress={() => navigate("password")}
            >
              <KeyRound className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onPress={onLogout}>
              <LogOut className="size-4" aria-hidden />
              退出
            </Button>
          </div>
        </header>
        {notice}
        <main className={cn("sol-admin-content", workspace && "sol-admin-workspace")}>
          {children}
        </main>
      </div>
    </div>
  );
}
