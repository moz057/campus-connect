// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import App from "./App";
import { demoEvents } from "./data/demo";

vi.mock("./lib/supabase", () => ({ configured: false, supabase: null }));

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/events");
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("email confirmation redirects", () => {
  it.each([
    "/login#error=access_denied&error_code=otp_expired",
    "/auth/callback#error=access_denied&error_code=otp_expired",
    "/auth/callback?error=access_denied&error_code=otp_expired",
  ])("shows recovery guidance and cleans %s", async (url) => {
    window.history.replaceState({}, "", url);
    render(<App />);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "This confirmation link has expired or has already been used.",
    );
    expect(window.location.pathname).toBe("/login");
    expect(window.location.search + window.location.hash).toBe("");
  });
});

describe("student workflows in the browser demo", () => {
  it("searches and filters upcoming events", async () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /Find your next thing/ }),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search events"), {
      target: { value: "basketball" },
    });
    expect(
      screen.getByRole("link", { name: demoEvents[2].title }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: demoEvents[0].title }),
    ).toBeNull();
    fireEvent.change(screen.getByLabelText("Search events"), {
      target: { value: "unfindable event" },
    });
    expect(
      screen.getByRole("heading", { name: "No events found" }),
    ).toBeTruthy();
  });
  it("registers, generates a QR ticket and cancels a registration", async () => {
    window.history.replaceState({}, "", "/events/event-1");
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Register for event" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "View my QR ticket" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      dialog.querySelector('svg[role="img"], .ticket-qr svg'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close ticket" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel registration" }),
    );
    expect(
      await screen.findByRole("button", { name: "Register for event" }),
    ).toBeTruthy();
  });
  it("waitlists a full event without creating a confirmed ticket", async () => {
    window.history.replaceState({}, "", "/events/event-4");
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Join the waitlist" }),
    );
    expect(await screen.findByText("You’re on the waitlist.")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "View my QR ticket" }),
    ).toBeNull();
  });
  it("keeps students out of organizer routes", async () => {
    window.history.replaceState({}, "", "/admin");
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "An organizer space" }),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Create an event" })).toBeNull();
  });
  it("saves profile edits", async () => {
    window.history.replaceState({}, "", "/profile");
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Full name"), {
      target: { value: "Taylor Student" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("cc-session")!).full_name).toBe(
        "Taylor Student",
      ),
    );
  });
});
describe("organizer demo workflow", () => {
  it("switches demo roles and creates, edits and deletes an event", async () => {
    window.history.replaceState({}, "", "/login");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Organizer/ }));
    fireEvent.click(
      await screen.findByRole("link", { name: "Create an event" }),
    );
    fireEvent.change(await screen.findByLabelText("Event title"), {
      target: { value: "Campus coffee meetup" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: {
        value:
          "Meet fellow Carolinians for a welcoming afternoon of conversations.",
      },
    });
    fireEvent.change(screen.getByLabelText("Venue"), {
      target: { value: "Campus garden" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish event" }));
    expect(
      await screen.findByRole("heading", { name: "Campus coffee meetup" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Edit event" }));
    fireEvent.change(await screen.findByLabelText("Event title"), {
      target: { value: "Campus coffee conversations" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save event" }));
    expect(
      await screen.findByRole("heading", {
        name: "Campus coffee conversations",
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete event" }));
    await waitFor(() => expect(window.location.pathname).toBe("/events"));
    expect(
      screen.queryByRole("heading", { name: "Campus coffee conversations" }),
    ).toBeNull();
  });
});
