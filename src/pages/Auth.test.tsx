// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AuthApiError } from "@supabase/supabase-js";
import { MemoryRouter } from "react-router-dom";
import Auth from "./Auth";
import { AuthProvider } from "../contexts/AuthContext";
import { ToastProvider } from "../contexts/ToastContext";

const { signIn, signUp } = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: signIn,
      signUp,
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

afterEach(cleanup);

function renderAuth(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <AuthProvider>
          <Auth />
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

it("offers a new confirmation email only after sign-in reports an unconfirmed email", async () => {
  signIn.mockRejectedValueOnce(
    new AuthApiError("Email not confirmed", 400, "email_not_confirmed"),
  );
  renderAuth("/login");
  const resendButton = { name: "Resend confirmation email" };
  expect(screen.queryByRole("button", resendButton)).toBeNull();
  const email = screen.getByLabelText("University email");
  fireEvent.change(email, { target: { value: "student@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "test-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
  expect(await screen.findByRole("button", resendButton)).toBeTruthy();
  fireEvent.change(email, { target: { value: "other@example.com" } });
  expect(screen.queryByRole("button", resendButton)).toBeNull();
});

it.each([
  { data: { user: { identities: [] }, session: null }, error: null },
  {
    data: { user: null, session: null },
    error: new AuthApiError(
      "User already registered",
      422,
      "user_already_exists",
    ),
  },
])("shows a login instruction for a duplicate signup", async (result) => {
  signUp.mockResolvedValueOnce(result);
  renderAuth("/register");
  for (const [label, value] of [
    ["Full name", "Test Student"],
    ["Student ID", "23104567"],
    ["University email", "student@example.com"],
    [/^Password/, "test-password"],
  ]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "An account already exists for this email. Log in instead.",
  );
  expect(screen.queryByRole("status")).toBeNull();
});
