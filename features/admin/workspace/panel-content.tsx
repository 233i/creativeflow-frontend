"use client";
import type { AdminTab } from "../admin-navigation";
import type { ManagedUser } from "../api";
import { ImageGenerationSettingsPanel } from "../image-generation-settings-panel";
import { PasswordPanel } from "../password-panel";
import { RequestHistoryPanel } from "../request-history/request-history-panel";
import { UserManagementPanel } from "../user-management-panel";
import { WorkflowCenterPanel } from "../workflow-center/panel";
import { WorkflowTemplateManagementPanel } from "../workflow-template-management-panel";
import { AssetCenterPanel } from "../asset-center/panel";
import { CredentialPanel } from "@/features/http-requests/credential-panel";
import { KnowledgePanel } from "@/features/knowledge/knowledge-panel";
import { ModelConfigPanel, ModelPanel, ProviderPanel } from "@/features/settings/management-panels";

export function AdminPanelContent({
  tab,
  username,
  onPasswordChanged,
  onViewRequests,
}: {
  tab: AdminTab;
  username: string;
  onPasswordChanged: () => void;
  onViewRequests: (user: ManagedUser) => void;
}) {
  const panels = {
    users: <UserManagementPanel onViewRequests={onViewRequests} />,
    requests: <RequestHistoryPanel />,
    assets: <AssetCenterPanel />,
    workflowTemplates: <WorkflowTemplateManagementPanel />,
    workflowApis: <WorkflowCenterPanel />,
    workflows: <WorkflowCenterPanel />,
    knowledge: <KnowledgePanel />,
    httpCredentials: <CredentialPanel />,
    providers: <ProviderPanel />,
    models: <ModelPanel />,
    modelConfig: <ModelConfigPanel />,
    imageSettings: <ImageGenerationSettingsPanel />,
    password: <PasswordPanel username={username} onChanged={onPasswordChanged} />,
  };
  return panels[tab];
}
