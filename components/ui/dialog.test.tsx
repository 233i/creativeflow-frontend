import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dialog, DialogTitle } from "./dialog";

describe("Dialog accessible names", () => {
  it("forwards the explicit name to the dialog, not the overlay", () => {
    render(
      <Dialog isOpen aria-label="工作区设置">
        <p>内容</p>
      </Dialog>,
    );
    expect(screen.getByRole("dialog", { name: "工作区设置" })).toBeVisible();
  });

  it("still uses the visible heading when no explicit name is supplied", () => {
    render(
      <Dialog isOpen>
        <DialogTitle>提示词库</DialogTitle>
      </Dialog>,
    );
    expect(screen.getByRole("dialog", { name: "提示词库" })).toBeVisible();
  });
});
