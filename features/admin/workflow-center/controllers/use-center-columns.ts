"use client";
import { useAdminPreference } from "@/features/admin/admin-preferences";
import { columnWidths } from "@/features/admin/workflow-center/column-settings";
import { useState } from "react";

export function useCenterColumns() {
  const [density, setDensity] = useAdminPreference("density", "default");
  const [columns, setColumns] = useAdminPreference("workflowColumns", "updatedAt");
  const [widthPreference, setWidthPreference] = useAdminPreference("workflowWidths", "{}");
  const widths = columnWidths(widthPreference);
  const [columnDialog, setColumnDialog] = useState(false);
  const selectedColumns = new Set(columns.split(","));
  function setColumn(key: string) {
    const next = new Set(selectedColumns);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setColumns([...next].join(","));
  }

  return {
    density,
    setDensity,
    columns,
    setColumns,
    widthPreference,
    setWidthPreference,
    widths,
    columnDialog,
    setColumnDialog,
    selectedColumns,
    setColumn,
  };
}
