import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: null as string | null }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

vi.mock("@/components/providers/i18n-provider", () => ({
  useT: () => (key: string) =>
    ({
      "auth.loading": "checking",
      "auth.requiredTitle": "sign in required",
      "auth.requiredDescription": "credentials required",
      "auth.requiredNotice": "canvas is locked",
      "auth.loginFailed": "authentication unavailable",
      "auth.retryStatus": "retry",
    })[key] ?? key,
}));

vi.mock("@/features/auth/password-auth-form", () => ({
  PasswordAuthForm: () => <div data-testid="password-form" />,
}));

vi.mock("@/features/auth/api", () => ({
  listProviders: vi.fn(),
  getMe: vi.fn(),
  loginWithPassword: vi.fn(),
  registerWithPassword: vi.fn(),
  logout: vi.fn(),
}));

const api = await import("@/features/auth/api");
const { AuthProvider } = await import("@/features/auth/auth-provider");
const { AuthGate } = await import("@/features/auth/auth-gate");

function renderGate() {
  return render(
    <AuthProvider>
      <AuthGate>
        <div data-testid="canvas">canvas</div>
      </AuthGate>
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  navigation.pathname = null;
  vi.mocked(api.listProviders).mockResolvedValue({ providers: [] });
});

describe("AuthGate", () => {
  it("keeps the independent admin login reachable without a user session", async () => {
    navigation.pathname = "/admin";
    vi.mocked(api.getMe).mockResolvedValue({ isGuest: true, account: null });

    renderGate();

    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });

  it("keeps the canvas unmounted for an anonymous visitor", async () => {
    vi.mocked(api.getMe).mockResolvedValue({ isGuest: true, account: null });

    renderGate();

    expect(await screen.findByText("sign in required")).toBeInTheDocument();
    expect(screen.getByTestId("password-form")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas")).not.toBeInTheDocument();
  });

  it("mounts the canvas only after the account session is confirmed", async () => {
    vi.mocked(api.getMe).mockResolvedValue({
      isGuest: false,
      account: {
        id: "account-1",
        displayName: "Alice",
        email: "alice@example.com",
        avatarUrl: null,
        externalProviders: [],
      },
    });

    renderGate();

    expect(await screen.findByTestId("canvas")).toBeInTheDocument();
    expect(screen.queryByText("sign in required")).not.toBeInTheDocument();
  });

  it("fails closed when authentication status cannot be loaded", async () => {
    vi.mocked(api.getMe).mockRejectedValue(new Error("offline"));

    renderGate();

    expect(await screen.findByText("sign in required")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("authentication unavailable");
    });
  });
});
