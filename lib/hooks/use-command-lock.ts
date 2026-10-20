"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRequestScope } from "./use-request-scope";

/** The ref closes the gap before React paints disabled controls. */
export function useCommandLock<Command extends string>(key: string | object) {
  const capture = useRequestScope(key);
  const held = useRef<symbol | null>(null);
  const [state, setState] = useState<{ key: string | object; command: Command } | null>(null);
  useLayoutEffect(() => {
    held.current = null;
  }, [key]);
  function acquire(command: Command) {
    const current = capture();
    if (held.current || !current()) return null;
    const token = Symbol(command);
    held.current = token;
    setState({ key, command });
    return {
      current,
      release() {
        if (held.current !== token) return;
        held.current = null;
        if (current()) setState(null);
      },
    };
  }
  return { pending: state?.key === key ? state.command : null, acquire };
}
