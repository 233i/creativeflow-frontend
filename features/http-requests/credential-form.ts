"use client";
import { type HttpCredentialForm } from "@/features/http-requests/credentials-api";

export const control = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
export const button =
  "shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-40";
export const empty = (): HttpCredentialForm => ({
  name: "",
  description: "",
  origin: "",
  headers: [{ name: "Authorization", value: "" }],
  requests: [{ method: "GET", url: "" }],
});
