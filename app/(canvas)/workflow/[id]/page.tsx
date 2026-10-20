import type { Metadata } from "next";
import { WorkflowPage } from "@/features/workflow/workflow-page";

export const metadata: Metadata = { title: "工作流" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkflowPage workflowId={id} />;
}
