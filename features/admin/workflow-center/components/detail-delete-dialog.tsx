"use client";
import { DeleteWorkflowDialog } from "@/features/admin/workflow-center/delete-dialog";
import type { WorkflowDetailController } from "../controllers/use-workflow-detail";
export function DetailDeleteDialog({ controller }: { controller: WorkflowDetailController }) {
  const {
    router,
    returnHref,
    setDocument,
    item,
    setItem,
    session,
    setSession,
    deleting,
    setDeleting,
    setPending,
    formDirty,
    setFormDirty,
    setFormBusy,
    navigationGuardRef,
    select,
  } = controller;
  return (
    <>
      {deleting && item && (
        <DeleteWorkflowDialog
          target={item}
          hasUnsavedChanges={!!session?.dirty || formDirty}
          onClose={() => setDeleting(false)}
          onNavigate={(next) => {
            setDeleting(false);
            select(next);
          }}
          onDeleted={() => {
            setDeleting(false);
            setFormDirty(false);
            setFormBusy(false);
            setDocument(null);
            setSession(null);
            setPending(null);
            navigationGuardRef.current = { formDirty: false, formBusy: false, editorDirty: false };
            setItem({ ...item, deletedAt: new Date().toISOString() });
            router.push(returnHref);
          }}
        />
      )}
    </>
  );
}
