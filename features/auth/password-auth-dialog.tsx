"use client";

import { LogIn } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useT } from "@/components/providers/i18n-provider";
import { PasswordAuthForm } from "@/features/auth/password-auth-form";

export function PasswordAuthDialog({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button size="sm" variant="default">
        <LogIn className="size-3.5" aria-hidden />
        <span className={compact ? "hidden sm:inline" : undefined}>
          {t("auth.loginOrRegister")}
        </span>
      </Button>
      <Dialog className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("auth.passwordDialogTitle")}</DialogTitle>
          <DialogDescription>{t("auth.passwordDialogDescription")}</DialogDescription>
        </DialogHeader>

        <PasswordAuthForm />
      </Dialog>
    </DialogTrigger>
  );
}
