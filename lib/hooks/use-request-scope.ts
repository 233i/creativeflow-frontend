"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/** Capture before awaiting. A changed document or unmounted editor invalidates the response. */
export function useRequestScope(key: string | object) {
  const generation = useRef(0);
  const alive = useRef(false);
  const identity = useRef(key);
  useLayoutEffect(() => {
    identity.current = key;
    alive.current = true;
    generation.current += 1;
    return () => {
      alive.current = false;
      generation.current += 1;
    };
  }, [key]);
  return useCallback(() => {
    const captured = generation.current;
    return () => alive.current && identity.current === key && captured === generation.current;
  }, [key]);
}
