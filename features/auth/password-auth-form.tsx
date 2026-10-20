"use client";

import { GitBranch, Loader2 } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthApiError } from "@/features/auth/api";
import { useAuth } from "@/features/auth/auth-provider";

type Mode = "login" | "register";

export function PasswordAuthForm() {
  const t = useT();
  const { providers, login, loginWithPassword, registerWithPassword } = useAuth();
  const github = providers.find((provider) => provider.key === "github");
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const displayNameId = useId();

  const changeMode = (next: Mode) => {
    setMode(next);
    setMessage(null);
    setPassword("");
    setConfirmPassword("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (mode === "register" && password !== confirmPassword) {
      setMessage(t("auth.passwordMismatch"));
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "register") {
        await registerWithPassword(email, password, displayName.trim() || undefined);
      } else {
        await loginWithPassword(email, password);
      }

      // 首次认证后的画布加载会执行或刷新设备握手，并在编辑器可交互前协调所有账户级数据。
      window.location.reload();
    } catch (reason) {
      setMessage(authErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 rounded-lg bg-muted p-1" role="group">
        {(["login", "register"] as const).map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={mode === item ? "secondary" : "ghost"}
            aria-pressed={mode === item}
            onPress={() => changeMode(item)}
          >
            {t(item === "login" ? "auth.passwordLogin" : "auth.passwordRegister")}
          </Button>
        ))}
      </div>

      <form className="flex flex-col gap-3" onSubmit={submit}>
        {mode === "register" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={displayNameId}>{t("auth.displayName")}</Label>
            <Input
              id={displayNameId}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
              maxLength={100}
              placeholder={t("auth.displayNamePlaceholder")}
              disabled={submitting}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={emailId}>{t("auth.email")}</Label>
          <Input
            id={emailId}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            placeholder={t("auth.emailPlaceholder")}
            required
            disabled={submitting}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={passwordId}>{t("auth.password")}</Label>
          <Input
            id={passwordId}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={10}
            maxLength={128}
            required
            disabled={submitting}
          />
          {mode === "register" && (
            <p className="text-xs text-muted-foreground">
              {t("auth.passwordRequirement", { min: 10 })}
            </p>
          )}
        </div>

        {mode === "register" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={confirmId}>{t("auth.confirmPassword")}</Label>
            <Input
              id={confirmId}
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
              disabled={submitting}
            />
          </div>
        )}

        {message && (
          <p
            className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
            role="alert"
          >
            {message}
          </p>
        )}

        <Button type="submit" size="lg" className="mt-1 w-full" isDisabled={submitting}>
          {submitting && <Loader2 className="animate-spin" aria-hidden />}
          {t(mode === "login" ? "auth.submitLogin" : "auth.submitRegister")}
        </Button>
      </form>

      {github && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("auth.orContinueWith")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            variant="outline"
            className="w-full"
            onPress={() => login(github.key)}
            isDisabled={submitting}
          >
            <GitBranch aria-hidden />
            {t("auth.loginWith", { provider: github.displayName })}
          </Button>
        </>
      )}

      <p className="text-center text-xs text-muted-foreground">{t("auth.loginHint")}</p>
    </div>
  );
}

function authErrorMessage(reason: unknown, t: ReturnType<typeof useT>): string {
  if (!(reason instanceof AuthApiError)) return t("auth.loginFailed");
  if (reason.status === 429) return t("auth.tooManyAttempts");
  switch (reason.code) {
    case "invalid_email":
      return t("auth.invalidEmail");
    case "invalid_password":
      return t("auth.invalidPassword");
    case "email_unavailable":
      return t("auth.emailUnavailable");
    case "device_unavailable":
      return t("auth.deviceUnavailable");
    case "account_disabled":
      return t("auth.accountDisabled");
    case "invalid_credentials":
      return t("auth.invalidCredentials");
    default:
      return t("auth.loginFailed");
  }
}
