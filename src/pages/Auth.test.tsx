// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AuthApiError } from "@supabase/supabase-js";
import { MemoryRouter } from "react-router-dom";
import Auth from "./Auth";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ profile: null, demo: false, signIn }),
}));
vi.mock("../lib/supabase", () => ({ supabase: null }));

afterEach(cleanup);

it("offers a new confirmation email only after sign-in reports an unconfirmed email", async () => {
  signIn.mockRejectedValueOnce(
    new AuthApiError("Email not confirmed", 400, "email_not_confirmed"),
  );
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Auth />
    </MemoryRouter>,
  );
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
