import { AdminConsole } from "@/features/admin/admin-console";

export const metadata = { title: "工作流中心", robots: { index: false, follow: false } };
export default function Page() {
  return <AdminConsole initialTab="workflows" />;
}
