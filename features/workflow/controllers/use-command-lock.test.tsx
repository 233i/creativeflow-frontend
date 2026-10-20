import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCommandLock } from "./use-command-lock";

describe("editor command ownership", () => {
  it("does not let a completed old session unlock a command in the new session", () => {
    const { result, rerender } = renderHook(({ id }) => useCommandLock<"save" | "run">(id), {
      initialProps: { id: "old" },
    });
    let old!: NonNullable<ReturnType<typeof result.current.acquire>>;
    act(() => {
      old = result.current.acquire("save")!;
    });
    expect(result.current.acquire("run")).toBeNull();
    rerender({ id: "new" });
    act(() => {
      result.current.acquire("run");
      old.release();
    });
    expect(old.current()).toBe(false);
    expect(result.current.pending).toBe("run");
    expect(result.current.acquire("save")).toBeNull();
  });
});
