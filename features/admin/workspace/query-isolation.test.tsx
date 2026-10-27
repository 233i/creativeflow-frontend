import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkspacePageContext, type WorkspacePage } from "@/components/providers/workspace-context";
import { useAdminQuery } from "../admin-query";

describe("queries belong to their workspace page", () => {
  it("reads each page's filters and updates an inactive page without navigating the active page", async () => {
    const navigate = vi.fn();
    const updateLocation = vi.fn();
    const page: WorkspacePage = {
      key: "menu:assets",
      href: "/admin?tab=assets&q=images&assetPage=2",
      active: false,
      navigate,
      updateLocation,
      updateMeta: vi.fn(),
      registerGuard: () => () => {},
    };
    function Query({ name }: { name: string }) {
      const [params, update] = useAdminQuery();
      return (
        <>
          <output data-testid={name}>{params.get("q")}</output>
          <button onClick={() => update({ asset: null, q: "updated" })}>{name}</button>
        </>
      );
    }
    window.history.replaceState(null, "", "/admin?tab=providers&q=global");
    render(
      <>
        <WorkspacePageContext.Provider value={page}>
          <Query name="assets" />
        </WorkspacePageContext.Provider>
        <WorkspacePageContext.Provider
          value={{ ...page, key: "menu:requests", href: "/admin/runs?q=requests", active: true }}
        >
          <Query name="requests" />
        </WorkspacePageContext.Provider>
      </>,
    );
    expect(screen.getByTestId("assets")).toHaveTextContent("images");
    expect(screen.getByTestId("requests")).toHaveTextContent("requests");
    await userEvent.click(screen.getByRole("button", { name: "assets" }));
    expect(updateLocation).toHaveBeenCalledWith("/admin?tab=assets&q=updated&assetPage=2", false);
    expect(navigate).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?tab=providers&q=global");
  });
});
