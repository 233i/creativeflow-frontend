"use client";
import { ColumnSettings } from "@/features/admin/workflow-center/column-settings";
import { CreateWorkflowDialog } from "@/features/admin/workflow-center/create-dialog";
import { DeleteWorkflowDialog } from "@/features/admin/workflow-center/delete-dialog";
import { CenterRunPreview } from "@/features/admin/workflow-center/run-preview";
import type { WorkflowCenterController } from "../controllers/use-workflow-center";
export function CenterDialogs({ controller }: { controller: WorkflowCenterController }) {
  const {
    router,
    update,
    setData,
    setRefresh,
    capability,
    selected,
    setSelected,
    page,
    currentPage,
    returnUrl,
    href,
    setColumns,
    setWidthPreference,
    columnDialog,
    setColumnDialog,
    selectedColumns,
    setColumn,
    creating,
    setCreating,
    initial,
    setInitial,
    deleting,
    setDeleting,
    setNotice,
    fileInput,
    importFile,
  } = controller;
  return (
    <>
      {" "}
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-label="导入工作流文件"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void importFile(file);
        }}
      />
      {creating && (
        <CreateWorkflowDialog
          key={initial?.name ?? "new"}
          initial={initial}
          enabled={!!capability?.enabled}
          onClose={() => {
            setCreating(false);
            setInitial(undefined);
          }}
          onCreated={(id) => {
            setCreating(false);
            router.push(
              `/admin/workflows/${encodeURIComponent(id)}/edit?${new URLSearchParams({ returnTo: returnUrl })}`,
            );
          }}
        />
      )}
      {selected?.latestRun && (
        <CenterRunPreview
          key={selected.source + selected.latestRun.id}
          item={selected}
          onClose={() => setSelected(null)}
        />
      )}
      {deleting && (
        <DeleteWorkflowDialog
          target={deleting}
          onClose={() => setDeleting(null)}
          onNavigate={(section) => router.push(href(deleting, section))}
          onDeleted={() => {
            setNotice(`已删除「${deleting.name}」，素材与历史记录已保留。`);
            setDeleting(null);
            setSelected(null);
            setData(null);
            if (page?.items.length === 1 && currentPage > 1)
              update({ page: String(currentPage - 1) });
            setRefresh((value) => value + 1);
          }}
        />
      )}
      {columnDialog && (
        <ColumnSettings
          visible={selectedColumns}
          onToggle={setColumn}
          onReset={() => {
            setWidthPreference("{}");
            setColumns("updatedAt");
          }}
          onClose={() => setColumnDialog(false)}
        />
      )}
    </>
  );
}
