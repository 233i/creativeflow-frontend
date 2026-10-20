import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NodeFeedback } from "./node-feedback";

describe("NodeFeedback", () => {
  it("retains the complete error in a scrollable, in-flow feedback area", () => {
    const message = "Upstream request failed. ".repeat(35);
    render(<NodeFeedback message={message} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(message);
    expect(alert).toHaveClass("overflow-y-auto", "shrink-0", "nowheel");
    expect(alert).not.toHaveClass("absolute");
    expect(alert.querySelector("p")).not.toHaveClass("line-clamp-2");
  });

  it("keeps recovery actions accessible and renders upstream markup as text", () => {
    render(
      <NodeFeedback
        message={"<html><h1>405 Not Allowed</h1></html>"}
        actions={<button>重试</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "重试" })).toBeVisible();
    expect(screen.getByRole("alert").querySelector("h1")).toBeNull();
    expect(screen.getByText("<html><h1>405 Not Allowed</h1></html>")).toBeVisible();
  });
});
