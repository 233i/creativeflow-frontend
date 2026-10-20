import { createApiClient } from "@/lib/api-client";

export interface AuthProvider {
  key: string;
  displayName: string;
}

export interface AuthAccount {
  id: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  externalProviders: string[];
}

export interface AuthMe {
  isGuest: boolean;
  account: AuthAccount | null;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

const BASE = "/api/v1/auth";

const request = createApiClient({
  baseUrl: BASE,
  networkErrorMessage: "Failed to reach the authentication API",
  statusErrorMessage: (status) => `Authentication request failed: ${status}`,
  createError: ({ code, details, status, fallbackMessage }) =>
    new AuthApiError(details[0] ?? fallbackMessage, status, code),
});

export function listProviders(): Promise<{ providers: AuthProvider[] }> {
  return request("/providers");
}

export function getMe(): Promise<AuthMe> {
  return request("/me");
}

export function registerWithPassword(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthMe> {
  return request("/password/register", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName: displayName || null }),
  });
}

export function loginWithPassword(email: string, password: string): Promise<AuthMe> {
  return request("/password/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<void> {
  return request("/logout", { method: "POST" });
}
