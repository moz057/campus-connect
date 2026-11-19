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
  it("opens account options before editing a profile or logging out", async () => {
    render(<App />);
    const account = screen.getByRole("button", { name: "Account options" });
    fireEvent.click(account);
    expect(window.location.pathname).toBe("/events");
    expect(account.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(account, { key: "Escape" });
    expect(screen.queryByRole("link", { name: "Edit profile" })).toBeNull();
    expect(document.activeElement).toBe(account);
    fireEvent.click(account);
    fireEvent.click(screen.getByRole("link", { name: "Edit profile" }));
    await screen.findByLabelText("Full name");
    expect(window.location.pathname).toBe("/profile");

    fireEvent.click(screen.getByRole("button", { name: "Account options" }));
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(
      await screen.findByRole("heading", { name: "Welcome back." }),
    ).toBeTruthy();
    expect(window.location.pathname).toBe("/login");
  });

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
  it("nominates within the leader's organization and shows the admin decision to the nominee", async () => {
    window.history.replaceState({}, "", "/login");
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Student Leader/ }),
    );
    const scope = await screen.findByRole("combobox", { name: "Organization" });
    expect(
      Array.from((scope as HTMLSelectElement).options).map(
        (option) => option.value,
      ),
    ).toEqual(["cis", "sports"]);
    expect(
      screen.queryByRole("link", { name: "Manage organizations" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Leadership" }));
    fireEvent.change(
      await screen.findByLabelText("Find a registered student"),
      { target: { value: "Alex Rivera" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Search students" }));
    fireEvent.change(await screen.findByLabelText("Student"), {
      target: { value: "demo-student" },
    });
    fireEvent.change(screen.getByLabelText("Position"), {
      target: { value: "Secretary" },
    });
    fireEvent.change(screen.getByLabelText("Term end"), {
      target: {
        value: new Date(Date.now() + 30 * 86_400_000)
          .toISOString()
          .slice(0, 10),
      },
    });
    fireEvent.change(
      screen.getByLabelText("Why are you nominating this student?"),
      { target: { value: "Experienced campus volunteer." } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit nomination" }));
    expect(await screen.findByText("pending", { exact: true })).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: /Demo Student Leader/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Organizer/ }));
    fireEvent.click(screen.getByRole("link", { name: "Manage organizations" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Nomination review" }),
    );
    fireEvent.change(screen.getByLabelText(/Decision reason/), {
      target: { value: "Verified by Student Affairs." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("approved", { exact: true })).toBeTruthy();

    fireEvent.click(
      screen.getByRole("link", { name: /Demo University Admin/ }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Discover & register/ }),
    );
    fireEvent.click(screen.getByRole("link", { name: /unread notifications/ }));
    expect(
      await screen.findByRole("link", {
        name: "Leadership nomination approved",
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /0 unread/ })).toBeTruthy(),
    );
    cleanup();
    render(<App />);
    expect(await screen.findByRole("link", { name: /0 unread/ })).toBeTruthy();
  });

  it("lets a student leader add an optional form and require confirmation before registration", async () => {
    const url = "https://forms.gle/campus-event";
    window.history.replaceState({}, "", "/login");
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Student Leader/ }),
    );
    fireEvent.click(
      await screen.findByRole("link", { name: "Create an event" }),
    );
    fireEvent.change(await screen.findByLabelText("Event title"), {
      target: { value: "Campus form meetup" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "A campus event with an external form." },
    });
    fireEvent.change(screen.getByLabelText("Venue"), {
      target: { value: "Campus garden" },
    });
    fireEvent.change(
      screen.getByLabelText(/Registration form link/),
      {
        target: { value: url },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Publish event" }));
    expect(
      (
        await screen.findByRole("link", { name: "Open optional form" })
      ).getAttribute("href"),
    ).toBe(url);
    expect(
      (
        screen.getByRole("button", {
          name: "Register for event",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);

    fireEvent.click(screen.getByRole("link", { name: "Edit event" }));
    fireEvent.click(
      await screen.findByRole("checkbox", {
        name: /Require students to confirm/,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save event" }));
    await screen.findByRole("link", { name: "Open required form" });
    const eventPath = window.location.pathname;

    fireEvent.click(screen.getByRole("link", { name: /Demo Student Leader/ }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Discover & register/ }),
    );
    cleanup();
    window.history.replaceState({}, "", eventPath);
    render(<App />);

    const register = await screen.findByRole<HTMLButtonElement>("button", {
      name: "Register for event",
    });
    expect(register.disabled).toBe(true);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "I submitted the event form" }),
    );
    expect(register.disabled).toBe(false);
    fireEvent.click(register);
    expect(
      await screen.findByRole("button", { name: "View my QR ticket" }),
    ).toBeTruthy();
  });

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
