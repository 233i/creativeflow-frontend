import "tdesign-react/es/style/index.css";
import "./admin.css";
import { AdminWorkspaceLayout } from "@/features/admin/workspace/layout";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminWorkspaceLayout>{children}</AdminWorkspaceLayout>;
}
