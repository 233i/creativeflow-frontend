"use client";

import { useRef, useState } from "react";
import { useCommandLock } from "@/lib/hooks/use-command-lock";
import { assetError } from "@/features/assets/commands";
import type { LibraryQuery } from "./use-library-query";
import type { LibrarySource } from "../types";

type Command =
  "reuse" | "remove" | "restore" | "assign" | "create-group" | "rename-group" | "delete-group";
export function useLibraryCommands(
  query: LibraryQuery,
  onOpenChange: (open: boolean) => void,
  source?: LibrarySource,
) {
  const lock = useCommandLock<Command>(source ?? "device-library");
  const closed = useRef(false);
  const [error, setErrorState] = useState<{
    scope: typeof query.scope;
    message: string | null;
  } | null>(null);
  function setError(message: string | null) {
    setErrorState({ scope: query.scope, message });
  }
  function close(open: boolean) {
    if (!open) closed.current = true;
    onOpenChange(open);
  }
  async function perform(
    command: Command,
    operation: (current: () => boolean) => Promise<void>,
    errorMessage = (reason: unknown) => assetError(reason, "操作未完成。"),
  ) {
    if (closed.current) return false;
    const lease = lock.acquire(command);
    if (!lease) return false;
    const inScope = query.capture();
    const current = () => lease.current() && inScope() && !closed.current;
    setError(null);
    try {
      await operation(current);
      return current();
    } catch (reason) {
      if (current()) setError(errorMessage(reason));
      return false;
    } finally {
      lease.release();
    }
  }
  return {
    busy: lock.pending,
    error: error?.scope === query.scope ? error.message : null,
    setError,
    close,
    perform,
  };
}
export type LibraryCommands = ReturnType<typeof useLibraryCommands>;
