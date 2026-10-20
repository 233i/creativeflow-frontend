import { afterEach, describe, expect, it, vi } from "vitest";
import { newClientId } from "@/lib/client-id";

describe("newClientId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses crypto.randomUUID when the browser provides it", () => {
    const randomUUID = vi.fn(() => "019ff133-8779-7c2b-8daf-d314eab7d869");
    vi.stubGlobal("crypto", { randomUUID });

    expect(newClientId()).toBe("019ff133-8779-7c2b-8daf-d314eab7d869");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("generates distinct ids when randomUUID is unavailable on plain HTTP", () => {
    vi.stubGlobal("crypto", {});

    const first = newClientId();
    const second = newClientId();

    expect(first).toMatch(/^n[a-z0-9]+-\d+$/);
    expect(second).toMatch(/^n[a-z0-9]+-\d+$/);
    expect(second).not.toBe(first);
  });
});
