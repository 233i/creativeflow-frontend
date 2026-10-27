import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DETAIL_SECTIONS } from "@/features/admin/workflow-center/detail-sections";

export const metadata: Metadata = { title: "工作流详情", robots: { index: false, follow: false } };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; section?: string[] }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { id, section = ["edit"] } = await params;
  const { source = "workflow" } = await searchParams;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
    section.length !== 1 ||
    !DETAIL_SECTIONS.some((value) => value.id === section[0]) ||
    !["workflow", "template"].includes(source)
  )
    notFound();
  return null;
}
