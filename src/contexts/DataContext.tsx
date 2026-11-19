import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { readPages, supabase } from "../lib/supabase";
import { useToast } from "./ToastContext";
import { useAuth } from "./AuthContext";
import { useOrganizations } from "./OrganizationContext";
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
  register: (
    id: string,
    waitlist?: boolean,
    confirmedFormUrl?: string,
  ) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  cancelManagedRegistration: (
    eventId: string,
    studentId: string,
  ) => Promise<void>;
  saveEvent: (event: Partial<CampusEvent>) => Promise<string>;
  deleteEvent: (id: string) => Promise<void>;
  checkIn: (eventId: string, token: string, manual?: boolean) => Promise<void>;
  archiveOrganization: (id: string) => Promise<void>;
  postAnnouncement: (
    title: string,
    body: string,
    event_id: string | null,
    organization_id?: string | null,
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
type RosterEntry = Omit<Registration, "qr_token"> &
  Pick<Profile, "full_name" | "student_id" | "course" | "year_level"> & {
    attendance_id: string | null;
    checked_in_at: string;
    checked_in_by: string;
  };
export function DataProvider({ children }: { children: ReactNode }) {
  const { profile, demo } = useAuth();
  const {
    organizations,
    memberships,
    canManage,
    archiveOrganization: archive,
    addDemoNotices,
    refresh: refreshNotices,
  } = useOrganizations();
  const location = useLocation();
  const user = profile?.id ?? "";
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
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    const request = ++sequence.current;
    setError("");
    try {
      function rows<T>(table: string) {
        return readPages<T>((from, to) =>
          client!.from(table).select("*").order("id").range(from, to),
        );
      }
      const [rawEvents, own, attendance, announcements, roster, counts] =
        await Promise.all([
          rows<CampusEvent>("events"),
          user ? rows<Registration>("registrations") : [],
          user ? rows<Attendance>("attendance") : [],
          user ? rows<Announcement>("announcements") : [],
          user
            ? readPages<RosterEntry>((from, to) =>
                client.rpc("managed_registrations").order("id").range(from, to),
              )
            : [],
          readPages<{ event_id: string; filled: number; waitlisted: number }>(
            (from, to) =>
              client.rpc("event_counts").order("event_id").range(from, to),
          ),
        ]);
      if (request !== sequence.current) return;
      const countByEvent = new Map(
        counts.map((count) => [count.event_id, count]),
      );
      const events = rawEvents.map((e) => ({
        ...e,
        filled: Number(countByEvent.get(e.id)?.filled ?? 0),
        waitlisted: Number(countByEvent.get(e.id)?.waitlisted ?? 0),
      }));
      const regs = new Map(own.map((r) => [r.id, r]));
      const checkIns = new Map(attendance.map((a) => [a.id, a]));
      const people = new Map<string, Profile>();
      for (const row of roster) {
        const {
          id,
          event_id,
          user_id,
          status,
          created_at,
          full_name,
          student_id,
          course,
          year_level,
          attendance_id,
          checked_in_at,
          checked_in_by,
        } = row;
        if (!regs.has(id))
          regs.set(id, {
            id,
            event_id,
            user_id,
            status,
            created_at,
            qr_token: "",
          });
        people.set(user_id, {
          id: user_id,
          full_name,
          student_id,
          course,
          year_level,
          organization: "",
          avatar_url: "",
          role: "student",
        });
        if (attendance_id)
          checkIns.set(attendance_id, {
            id: attendance_id,
            registration_id: id,
            checked_in_at,
            checked_in_by,
          });
      }
      setState({
        events,
        registrations: [...regs.values()],
        attendance: [...checkIns.values()],
        announcements,
        people: [...people.values()],
      });
      setLoadedFor(user);
    } catch (e) {
      if (request !== sequence.current) return;
      setError(
        e instanceof Error
          ? e.message
          : String(
              (e as { message?: string }).message ||
                "Could not load campus data.",
            ),
      );
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      sequence.current++;
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, location.key]);
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
  const current = demo || loadedFor === user ? state : empty;
  const events = current.events.map((event) => {
    const org = organizations.find(
      (o) =>
        o.id === event.organization_id ||
        (demo &&
          event.organization_id === undefined &&
          o.name === event.organization),
    );
    if (!org) return event;
    return { ...event, organization_id: org.id, organization: org.name };
  });
  function requireOrganizer(organizationId?: string | null) {
    const p = requireProfile();
    if (!canManage(organizationId))
      throw Error("Organizer access required for this event.");
    return p;
  }
  function notifyEvent(
    recipient_id: string,
    event: CampusEvent,
    type: string,
    title: string,
    removed = false,
  ) {
    return {
      recipient_id,
      type,
      title,
      message: event.title,
      organization_id: event.organization_id,
      event_id: removed ? null : event.id,
      destination: removed ? "/registrations" : "/events/" + event.id,
    };
  }
  async function archiveOrganization(id: string) {
    const cancelled = events.filter(
      (e) =>
        e.organization_id === id &&
        !e.cancelled_at &&
        Date.parse(e.start_time) > Date.now(),
    );
    await archive(id);
    if (!demo) {
      await Promise.all([refresh(), refreshNotices()]);
      return;
    }
    setState((s) => ({
      ...s,
      events: s.events.map((e) =>
        cancelled.some((item) => item.id === e.id)
          ? { ...e, cancelled_at: new Date().toISOString() }
          : e,
      ),
    }));
    addDemoNotices(
      cancelled.flatMap((e) =>
        state.registrations
          .filter((r) => r.event_id === e.id && r.status !== "cancelled")
          .map((r) =>
            notifyEvent(r.user_id, e, "event_cancelled", "Event cancelled"),
          ),
      ),
    );
  }
  async function register(
    id: string,
    waitlist = false,
    confirmedFormUrl?: string,
  ) {
    const p = requireProfile();
    if (supabase) {
      const { error } = await supabase.rpc("register_for_event", {
        p_event_id: id,
        p_waitlist: waitlist,
        ...(confirmedFormUrl && { p_confirmed_form_url: confirmedFormUrl }),
      });
      if (error) throw error;
      await Promise.all([refresh(), refreshNotices()]);
      return;
    }
    const e = events.find((e) => e.id === id);
    if (!e) throw Error("Event not found.");
    if (isClosed(e)) throw Error("Registration has closed.");
    if (
      e.registration_form_required &&
      confirmedFormUrl !== e.registration_form_url
    )
      throw Error(
        "Confirm you submitted the current event form before registering.",
      );
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
    addDemoNotices([
      notifyEvent(
        p.id,
        e,
        full ? "waitlisted" : "registration_confirmed",
        full ? "You joined the waitlist" : "Registration confirmed",
      ),
    ]);
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
    await cancelFor(id, requireProfile().id, false);
  }
  async function cancelManagedRegistration(id: string, studentId: string) {
    const event = events.find((item) => item.id === id);
    if (!event) throw Error("Event not found.");
    requireOrganizer(event.organization_id);
    await cancelFor(id, studentId, true);
  }
  async function cancelFor(id: string, studentId: string, managed: boolean) {
    if (supabase) {
      const { error } = await (managed
        ? supabase.rpc("cancel_managed_registration", {
            p_event_id: id,
            p_student: studentId,
          })
        : supabase.rpc("cancel_registration", { p_event_id: id }));
      if (error) throw error;
      await Promise.all([refresh(), refreshNotices()]);
      return;
    }
    const e = state.events.find((e) => e.id === id);
    const r = state.registrations.find(
      (r) =>
        r.event_id === id &&
        r.user_id === studentId &&
        r.status !== "cancelled",
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
    if (promoted)
      addDemoNotices([
        notifyEvent(
          promoted.user_id,
          e,
          "waitlist_promoted",
          "A seat opened for you",
        ),
      ]);
    if (managed)
      addDemoNotices([
        notifyEvent(
          r.user_id,
          e,
          "registration_cancelled",
          "Your registration was cancelled",
        ),
      ]);
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
    const existing = events.find((e) => e.id === event.id);
    const organizationId =
      event.organization_id === undefined
        ? existing?.organization_id
        : event.organization_id;
    const p = requireOrganizer(organizationId);
    if (event.id && !existing) throw Error("Event not found.");
    if (existing) requireOrganizer(existing.organization_id);
    if (
      existing &&
      p.role !== "admin" &&
      organizationId !== existing.organization_id
    )
      throw Error("Only university admins may reassign events.");
    if (
      organizationId &&
      organizationId !== existing?.organization_id &&
      organizations.find((o) => o.id === organizationId)?.archived_at
    )
      throw Error("This organization is archived.");
    const formUrl =
      event.registration_form_url === undefined
        ? (existing?.registration_form_url ?? null)
        : event.registration_form_url?.trim() || null;
    const formRequired =
      event.registration_form_required ??
      existing?.registration_form_required ??
      false;
    const invalid = validateEvent({
      ...event,
      registration_form_url: formUrl,
      registration_form_required: formRequired,
    });
    if (invalid) throw Error(invalid);
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
      organization_id: organizationId ?? null,
      venue,
      start_time,
      end_time,
      banner_url,
      capacity,
      registration_deadline,
      registration_form_url: formUrl,
      registration_form_required: formRequired,
    };
    if (supabase) {
      const query = event.id
        ? supabase.from("events").update(fields).eq("id", event.id)
        : supabase.from("events").insert({ ...fields, created_by: p.id });
      const { data, error } = await query.select().single();
      if (error) throw error;
      await Promise.all([refresh(), refreshNotices()]);
      return data.id as string;
    }
    const result = {
      ...existing,
      ...fields,
      id: event.id || crypto.randomUUID(),
      created_by: p.id,
      created_at: new Date().toISOString(),
      filled: existing?.filled || 0,
      waitlisted: existing?.waitlisted || 0,
    } as CampusEvent;
    if (
      existing &&
      !existing.cancelled_at &&
      (existing.start_time !== result.start_time ||
        existing.end_time !== result.end_time ||
        existing.venue !== result.venue)
    ) {
      addDemoNotices(
        state.registrations
          .filter((r) => r.event_id === result.id && r.status !== "cancelled")
          .map((r) =>
            notifyEvent(
              r.user_id,
              result,
              "event_changed",
              "Event schedule or venue changed",
            ),
          ),
      );
    }
    setState((s) => ({
      ...s,
      events: [...s.events.filter((e) => e.id !== result.id), result],
    }));
    return result.id;
  }
  async function deleteEvent(id: string) {
    const event = events.find((e) => e.id === id);
    if (!event) throw Error("Event not found.");
    requireOrganizer(event.organization_id);
    if (supabase) {
      const { data, error } = await supabase
        .from("events")
        .delete()
        .eq("id", id)
        .select("id")
        .single();
      if (error) throw error;
      if (!data) throw Error("Event could not be deleted.");
      await Promise.all([refresh(), refreshNotices()]);
      return;
    }
    const ids = state.registrations
      .filter((r) => r.event_id === id)
      .map((r) => r.id);
    if (!event.cancelled_at && Date.parse(event.start_time) > Date.now()) {
      addDemoNotices(
        state.registrations
          .filter((r) => ids.includes(r.id) && r.status !== "cancelled")
          .map((r) =>
            notifyEvent(
              r.user_id,
              event,
              "event_cancelled",
              "Event cancelled",
              true,
            ),
          ),
      );
    }
    setState((s) => ({
      ...s,
      events: s.events.filter((e) => e.id !== id),
      registrations: s.registrations.filter((r) => r.event_id !== id),
      attendance: s.attendance.filter((a) => !ids.includes(a.registration_id)),
      announcements: s.announcements.filter((a) => a.event_id !== id),
    }));
  }
  async function checkIn(eventId: string, token: string, manual = false) {
    const event = events.find((e) => e.id === eventId);
    if (!event || event.cancelled_at) throw Error("This event is unavailable.");
    const p = requireOrganizer(event.organization_id);
    if (supabase) {
      const { error } = await (manual
        ? supabase.rpc("check_in_registration", {
            p_event_id: eventId,
            p_registration_id: token,
          })
        : supabase.rpc("check_in", { p_event_id: eventId, p_qr_token: token }));
      if (error) throw error;
      await refresh();
      return;
    }
    const r = state.registrations.find(
      (r) =>
        r.event_id === eventId &&
        (manual ? r.id : r.qr_token) === token &&
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
    organization_id: string | null = null,
  ) {
    const event = events.find((e) => e.id === event_id);
    if (event_id && !event) throw Error("Event not found.");
    const p = requireOrganizer(
      event_id ? event?.organization_id : organization_id,
    );
    if (title.trim().length < 3 || body.trim().length < 3)
      throw Error("Title and message must each contain at least 3 characters.");
    if (supabase) {
      const { error } = await supabase
        .from("announcements")
        .insert({ title, body, event_id, organization_id, created_by: p.id });
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
          organization_id,
          created_by: p.id,
          created_at: new Date().toISOString(),
        },
        ...s.announcements,
      ],
    }));
  }
  const announcements = demo
    ? current.announcements.filter(
        (a) =>
          (!a.event_id &&
            (!a.organization_id ||
              canManage(a.organization_id) ||
              memberships.some(
                (m) =>
                  m.student_id === user &&
                  m.organization_id === a.organization_id,
              ))) ||
          (a.event_id &&
            (canManage(
              events.find((e) => e.id === a.event_id)?.organization_id,
            ) ||
              current.registrations.some(
                (r) =>
                  r.user_id === profile?.id &&
                  r.event_id === a.event_id &&
                  r.status !== "cancelled",
              ))),
      )
    : current.announcements;
  // Demo data includes sample records for management; connected data is already scoped by the database.
  const managedEventIds = new Set(
    events.filter((e) => canManage(e.organization_id)).map((e) => e.id),
  );
  const registrations = current.registrations.filter(
    (r) => r.user_id === user || managedEventIds.has(r.event_id),
  );
  const registrationIds = new Set(registrations.map((r) => r.id));
  return (
    <Context.Provider
      value={{
        ...current,
        events,
        registrations,
        attendance: current.attendance.filter((a) =>
          registrationIds.has(a.registration_id),
        ),
        people: [
          ...current.people.filter((p) => p.id !== profile?.id),
          ...(profile ? [profile] : []),
        ],
        announcements,
        loading: loading || (!demo && loadedFor !== user && !error),
        error,
        refresh,
        register,
        cancel,
        cancelManagedRegistration,
        saveEvent,
        deleteEvent,
        checkIn,
        archiveOrganization,
        postAnnouncement,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useData = () => useContext(Context);
export function useWorkspaceData() {
  const data = useData();
  const { canManage, scope } = useOrganizations();
  const events = data.events.filter(
    (e) =>
      canManage(e.organization_id) && (!scope || e.organization_id === scope),
  );
  const eventIds = new Set(events.map((e) => e.id));
  const registrations = data.registrations.filter((r) =>
    eventIds.has(r.event_id),
  );
  const registrationIds = new Set(registrations.map((r) => r.id));
  const participants = new Set(registrations.map((r) => r.user_id));
  return {
    ...data,
    events,
    registrations,
    attendance: data.attendance.filter((a) =>
      registrationIds.has(a.registration_id),
    ),
    people: data.people.filter((p) => participants.has(p.id)),
  };
}
