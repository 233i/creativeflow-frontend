import { createApiClient } from "@/lib/api-client";

const BASE = "/api/v1/skills";

export type SkillRiskLevel = "safe" | "warning" | "danger";

export interface SkillRiskFinding {
  code: string;
  severity: SkillRiskLevel;
  path: string;
  line: number | null;
  message: string;
}

export interface SkillScan {
  name: string;
  slug: string;
  description: string;
  hasScripts: boolean;
  maxRisk: SkillRiskLevel;
  risks: SkillRiskFinding[];
  files: string[];
  byteSize: number;
}

export interface Skill extends Omit<SkillScan, "files"> {
  id: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export class SkillApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SkillApiError";
  }
}

const request = createApiClient({
  baseUrl: BASE,
  createError: ({ code, details, status, fallbackMessage }) =>
    new SkillApiError(details[0] ?? code ?? fallbackMessage, status),
});

export interface SkillList {
  sandboxEnabled: boolean;
  skills: Skill[];
}

export function listSkills(): Promise<SkillList> {
  return request("/");
}

export function scanSkill(file: File): Promise<SkillScan> {
  const form = new FormData();
  form.append("file", file);
  return request("/scan", { method: "POST", body: form });
}

export function installSkill(file: File, confirmDanger: boolean): Promise<Skill> {
  const form = new FormData();
  form.append("file", file);
  return request(`/?confirmDanger=${confirmDanger ? "true" : "false"}`, {
    method: "POST",
    body: form,
  });
}

export function deleteSkill(id: string): Promise<void> {
  return request(`/${id}`, { method: "DELETE" });
}
