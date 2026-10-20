"use client";
import type { CredentialManagerController } from "@/features/http-requests/controllers/use-credential-manager";
export function CredentialRevisions({ controller }: { controller: CredentialManagerController }) {
  const { detail } = controller;
  return (
    <details className="mt-5 rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        版本记录（{detail!.revisions.length}）
      </summary>
      <ul className="mt-3 space-y-3">
        {detail!.revisions.map((revision) => (
          <li key={revision.id} className="border-t pt-2 text-xs">
            <p>
              {new Date(revision.createdAt).toLocaleString()}{" "}
              {revision.id === detail!.currentRevision ? "· 当前版本" : ""}
            </p>
            <p className="break-all text-muted-foreground">{revision.id}</p>
            {revision.definition.requests.map((scope, i) => (
              <p key={i} className="break-all">
                {scope.method} {scope.url}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </details>
  );
}
