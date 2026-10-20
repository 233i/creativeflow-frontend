"use client";
import {
  DETAIL_SECTIONS,
  type DetailSection,
} from "@/features/admin/workflow-center/detail-context";

export const sectionEvent = "creativeflow:workflow-detail-section";
export function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(sectionEvent, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(sectionEvent, listener);
  };
}
export function detailSection(value?: string): DetailSection {
  return DETAIL_SECTIONS.some((section) => section.id === value)
    ? (value as DetailSection)
    : "edit";
}
