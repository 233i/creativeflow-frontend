import { describe, expect, it } from "vitest";
import { adminTabHref } from "./admin-navigation";

describe("adminTabHref", () => {
  it("keeps the workspace tabs on the shared admin route", () => {
    expect(adminTabHref("workflows")).toBe("/admin?tab=workflows");
    expect(adminTabHref("requests")).toBe("/admin?tab=requests");
    expect(adminTabHref("workflowTemplates")).toBe("/admin?tab=workflowTemplates");
  });
});
