"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-provider";
import { PasswordAuthForm } from "@/features/auth/password-auth-form";

export function AuthGate({ children }: { children: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const { account, loading, error, refresh } = useAuth();

  // 管理员拥有独立登录和会话边界。没有普通用户登录时也必须可以访问，
  // 否则首次部署将永远无法配置。
  if (pathname === "/admin" || pathname?.startsWith("/admin/")) return children;

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background" aria-live="polite">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("auth.loading")}
        </div>
      </div>
    );
  }

  if (account) return children;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <main className="flex w-full max-w-md flex-col items-center gap-7">
        <Brand className="[&>span]:text-xl" />

        <Card className="w-full gap-6 rounded-2xl border py-8 shadow-panel ring-0">
          <CardHeader className="gap-3 px-8">
            <CardTitle className="text-2xl tracking-tight">{t("auth.requiredTitle")}</CardTitle>
            <CardDescription>{t("auth.requiredDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 px-8">
            {error && (
              <div
                className="flex items-center justify-between gap-3 rounded-lg bg-destructive/10 px-3 py-2"
                role="alert"
              >
                <p className="text-xs text-destructive">{t("auth.loginFailed")}</p>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="shrink-0 text-destructive hover:text-destructive"
                  onPress={() => void refresh()}
                >
                  <RefreshCw aria-hidden />
                  {t("auth.retryStatus")}
                </Button>
              </div>
            )}
            <PasswordAuthForm />
          </CardContent>
        </Card>

        <p className="px-4 text-center text-xs leading-5 text-muted-foreground">
          {t("auth.requiredNotice")}
        </p>
      </main>
    </div>
  );
}
