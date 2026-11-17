import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useToast } from "./ToastContext";
import { useAuth } from "./AuthContext";
import {
  demoEvents,
  demoRegistrations,
  demoAnnouncements,
  demoPeople,
  demoAttendance,
} from "../data/demo";
import type {
  CampusEvent,
  Registration,
  Attendance,
  Announcement,
  Profile,
} from "../lib/types";
import { isClosed, validateEvent } from "../lib/utils";
interface DataState {
  events: CampusEvent[];
  registrations: Registration[];
  attendance: Attendance[];
  announcements: Announcement[];
  people: Profile[];
}
interface DataValue extends DataState {
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  register: (id: string, waitlist?: boolean) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  saveEvent: (event: Partial<CampusEvent>) => Promise<string>;
  deleteEvent: (id: string) => Promise<void>;
  checkIn: (eventId: string, token: string) => Promise<void>;
  postAnnouncement: (
    title: string,
    body: string,
    event_id: string | null,
  ) => Promise<void>;
}
const initial: DataState = {
  events: demoEvents,
  registrations: demoRegistrations,
  attendance: demoAttendance,
  announcements: demoAnnouncements,
  people: demoPeople,
};
const empty: DataState = {
  events: [],
  registrations: [],
  attendance: [],
  announcements: [],
  people: [],
};
const Context = createContext<DataValue>(null!);
export function DataProvider({ children }: { children: ReactNode }) {
  const { profile, demo } = useAuth();
  const notify = useToast();
  const [state, setState] = useState<DataState>(() => {
    if (!demo) return empty;
    try {
      return (
        JSON.parse(localStorage.getItem("cc-data-v1") || "null") || initial
      );
    } catch {
      return initial;
    }
  });
  const [loading, setLoading] = useState(!demo),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!supabase) return;
    setError("");
    try {
      const tables = profile
        ? ["events", "registrations", "attendance", "announcements", "profiles"]
        : ["events"];
      // Page through PostgREST's default row limit so reports include every record.
      async function allRows(table: string) {
        const rows: unknown[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await supabase!
            .from(table)
            .select("*")
            .order("id")
            .range(offset, offset + 499);
          if (error) throw error;
          rows.push(...data);
          if (data.length < 500) break;
        }
        return { data: rows };
      }
      const responses = await Promise.all(tables.map(allRows));
      const counts: { event_id: string; filled: number; waitlisted: number }[] =
        [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase
          .rpc("event_counts")
          .order("event_id")
          .range(offset, offset + 499);
        if (error) throw error;
        counts.push(...data);
        if (data.length < 500) break;
      }
      const events = (responses[0].data as CampusEvent[]).map((e) => ({
        ...e,
        filled: Number(
          counts?.find((c: { event_id: string }) => c.event_id === e.id)
            ?.filled || 0,
        ),
        waitlisted: Number(
          counts?.find((c: { event_id: string }) => c.event_id === e.id)
            ?.waitlisted || 0,
        ),
      }));
      setState({
        events,
        registrations: (responses[1]?.data || []) as Registration[],
        attendance: (responses[2]?.data || []) as Attendance[],
        announcements: (responses[3]?.data || []) as Announcement[],
        people: (responses[4]?.data || []) as Profile[],
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : String(
              (e as { message?: string }).message ||
                "Could not load campus data.",
            ),
      );
    } finally {
      setLoading(false);
    }
  }, [profile]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (demo) {
      try {
        localStorage.setItem("cc-data-v1", JSON.stringify(state));
      } catch {
        notify(
          "Demo storage is full. New changes may not persist after a refresh.",
          true,
        );
      }
    }
  }, [state, demo]);
  function requireProfile() {
    if (!profile) throw Error("Please log in to continue.");
    return profile;
  }
  function requireAdmin() {
    const p = requireProfile();
    if (p.role !== "admin") throw Error("Organizer access required.");
    return p;
  }
  async function register(id: string, waitlist = false) {
    const p = requireProfile();
    if (supabase) {
      const { error } = await supabase.rpc("register_for_event", {
        p_event_id: id,
        p_waitlist: waitlist,
      });
      if (error) throw error;
      await refresh();
      return;
    }
    const e = state.events.find((e) => e.id === id);
    if (!e) throw Error("Event not found.");
    if (isClosed(e)) throw Error("Registration has closed.");
    if (
      state.registrations.some(
        (r) =>
          r.event_id === id && r.user_id === p.id && r.status !== "cancelled",
      )
    )
      throw Error("You already registered.");
    const full = (e.filled || 0) >= e.capacity;
    if (full && !waitlist)
      throw Error("This event is full. Join the waitlist.");
    const r: Registration = {
      id: crypto.randomUUID(),
      event_id: id,
      user_id: p.id,
      status: full ? "waitlisted" : "registered",
      qr_token: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      registrations: [
        ...s.registrations.filter(
          (x) => x.event_id !== id || x.user_id !== p.id,
        ),
        r,
      ],
      events: s.events.map((x) =>
        x.id === id
          ? {
              ...x,
              filled: (x.filled || 0) + (full ? 0 : 1),
              waitlisted: (x.waitlisted || 0) + (full ? 1 : 0),
            }
          : x,
      ),
    }));
  }
  async function cancel(id: string) {
    const p = requireProfile();
    if (supabase) {
      const { error } = await supabase.rpc("cancel_registration", {
        p_event_id: id,
      });
      if (error) throw error;
      await refresh();
      return;
    }
    const e = state.events.find((e) => e.id === id);
    const r = state.registrations.find(
      (r) =>
        r.event_id === id && r.user_id === p.id && r.status !== "cancelled",
    );
    if (!r || !e) throw Error("Registration not found.");
    if (new Date(e.start_time).getTime() <= Date.now())
      throw Error("This event has already started.");
    if (state.attendance.some((a) => a.registration_id === r.id))
      throw Error("An attended ticket cannot be cancelled.");
    const promoted =
      r.status === "registered" && !isClosed(e)
        ? state.registrations
            .filter((x) => x.event_id === id && x.status === "waitlisted")
            .sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
        : null;
    setState((s) => ({
      ...s,
      registrations: s.registrations.map((x) =>
        x.id === r.id
          ? { ...x, status: "cancelled", qr_token: crypto.randomUUID() }
          : x.id === promoted?.id
            ? { ...x, status: "registered", qr_token: crypto.randomUUID() }
            : x,
      ),
      events: s.events.map((x) =>
        x.id === id
          ? {
              ...x,
              filled:
                (x.filled || 0) -
                (r.status === "registered" && !promoted ? 1 : 0),
              waitlisted: Math.max(
                0,
                (x.waitlisted || 0) -
                  (r.status === "waitlisted" || promoted ? 1 : 0),
              ),
            }
          : x,
      ),
    }));
  }
  async function saveEvent(event: Partial<CampusEvent>) {
    const p = requireAdmin();
    const invalid = validateEvent(event);
    if (invalid) throw Error(invalid);
    const existing = state.events.find((e) => e.id === event.id);
    if (existing && (event.capacity || 0) < (existing.filled || 0))
      throw Error("Capacity cannot be below confirmed registrations.");
    const {
      title,
      description,
      category,
      organization,
      venue,
      start_time,
      end_time,
      banner_url,
      capacity,
      registration_deadline,
    } = event;
    const fields = {
      title,
      description,
      category,
      organization,
      venue,
      start_time,
      end_time,
      banner_url,
      capacity,
      registration_deadline,
    };
    if (supabase) {
      const query = event.id
        ? supabase.from("events").update(fields).eq("id", event.id)
        : supabase.from("events").insert({ ...fields, created_by: p.id });
      const { data, error } = await query.select().single();
      if (error) throw error;
      await refresh();
      return data.id as string;
    }
    const result = {
      ...fields,
      id: event.id || crypto.randomUUID(),
      created_by: p.id,
      created_at: new Date().toISOString(),
      filled: existing?.filled || 0,
      waitlisted: existing?.waitlisted || 0,
    } as CampusEvent;
    setState((s) => ({
      ...s,
      events: [...s.events.filter((e) => e.id !== result.id), result],
    }));
    return result.id;
  }
  async function deleteEvent(id: string) {
    requireAdmin();
    if (supabase) {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
      await refresh();
      return;
    }
    const ids = state.registrations
      .filter((r) => r.event_id === id)
      .map((r) => r.id);
    setState((s) => ({
      ...s,
      events: s.events.filter((e) => e.id !== id),
      registrations: s.registrations.filter((r) => r.event_id !== id),
      attendance: s.attendance.filter((a) => !ids.includes(a.registration_id)),
      announcements: s.announcements.filter((a) => a.event_id !== id),
    }));
  }
  async function checkIn(eventId: string, token: string) {
    const p = requireAdmin();
    if (supabase) {
      const { error } = await supabase.rpc("check_in", {
        p_event_id: eventId,
        p_qr_token: token,
      });
      if (error) throw error;
      await refresh();
      return;
    }
    const r = state.registrations.find(
      (r) =>
        r.event_id === eventId &&
        r.qr_token === token &&
        r.status === "registered",
    );
    if (!r) throw Error("Invalid ticket for this event.");
    if (state.attendance.some((a) => a.registration_id === r.id))
      throw Error("This student has already checked in.");
    setState((s) => ({
      ...s,
      attendance: [
        ...s.attendance,
        {
          id: crypto.randomUUID(),
          registration_id: r.id,
          checked_in_at: new Date().toISOString(),
          checked_in_by: p.id,
        },
      ],
    }));
  }
  async function postAnnouncement(
    title: string,
    body: string,
    event_id: string | null,
  ) {
    const p = requireAdmin();
    if (title.trim().length < 3 || body.trim().length < 3)
      throw Error("Title and message must each contain at least 3 characters.");
    if (supabase) {
      const { error } = await supabase
        .from("announcements")
        .insert({ title, body, event_id, created_by: p.id });
      if (error) throw error;
      await refresh();
      return;
    }
    setState((s) => ({
      ...s,
      announcements: [
        {
          id: crypto.randomUUID(),
          title,
          body,
          event_id,
          created_by: p.id,
          created_at: new Date().toISOString(),
        },
        ...s.announcements,
      ],
    }));
  }
  const announcements = state.announcements.filter(
    (a) =>
      !a.event_id ||
      profile?.role === "admin" ||
      state.registrations.some(
        (r) =>
          r.user_id === profile?.id &&
          r.event_id === a.event_id &&
          r.status !== "cancelled",
      ),
  );
  return (
    <Context.Provider
      value={{
        ...state,
        people: [
          ...state.people.filter((p) => p.id !== profile?.id),
          ...(profile ? [profile] : []),
        ],
        announcements,
        loading,
        error,
        refresh,
        register,
        cancel,
        saveEvent,
        deleteEvent,
        checkIn,
        postAnnouncement,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useData = () => useContext(Context);
