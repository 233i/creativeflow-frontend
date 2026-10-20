import type { Metadata } from "next";
import { AdminConsole } from "@/features/admin/admin-console";
import { parseAdminTab } from "@/features/admin/admin-navigation";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "管理后台",
  robots: { index: false, follow: false },
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const query = await searchParams;
  if (query.tab === "workflowApis") redirect("/admin/workflows?view=api");
  const initialTab = parseAdminTab(query.tab);
  return <AdminConsole initialTab={initialTab} />;
}
