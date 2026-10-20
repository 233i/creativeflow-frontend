import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PublicationTabs } from "./publication-tabs";

describe("PublicationTabs", () => {
  it("switches complete panels with clicks and keyboard navigation", async () => {
    const user = userEvent.setup();
    render(
      <PublicationTabs
        sections={{
          versions: <p>版本内容</p>,
          contract: <p>参数内容</p>,
          keys: <button>创建 Key</button>,
          example: <code>curl example</code>,
          runs: <p>调用历史</p>,
        }}
      />,
    );
    expect(screen.getByRole("tabpanel", { name: "参数契约" })).toHaveTextContent("参数内容");
    await user.click(screen.getByRole("tab", { name: "API Key" }));
    expect(screen.getByRole("button", { name: "创建 Key" })).toBeVisible();
    await user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "调用示例" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
    expect(screen.getByRole("tabpanel", { name: "调用示例" })).toHaveTextContent("curl example");
    expect(screen.queryByRole("button", { name: "创建 Key" })).toBeNull();
  });
});
