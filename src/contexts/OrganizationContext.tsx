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
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { demoPeople } from "../data/demo";
import { readPages, supabase } from "../lib/supabase";
import type {
  Announcement,
  AnnouncementRead,
  CampusNotification,
  LeadershipHistory,
  LeadershipTerm,
  Membership,
  Nomination,
  Organization,
  StudentSummary,
} from "../lib/types";

type OrganizationDraft = Pick<
  Organization,
  "name" | "description" | "logo_url" | "faculty_adviser"
>;
type NoticeDraft = Omit<CampusNotification, "id" | "created_at" | "read_at">;
interface Directory {
  organizations: Organization[];
  memberships: Membership[];
  nominations: Nomination[];
  history: LeadershipHistory[];
  leadershipPeople: StudentSummary[];
  notifications: CampusNotification[];
  announcementReads: AnnouncementRead[];
}
const empty: Directory = {
  organizations: [],
  memberships: [],
  nominations: [],
  history: [],
  leadershipPeople: [],
  notifications: [],
  announcementReads: [],
};
const demoKey = "cc-organization-workflows";
export const campusDate = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
function dateIn(days: number) {
  const date = new Date(campusDate() + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function demoDirectory(): Directory {
  try {
    const saved = localStorage.getItem(demoKey);
    if (saved) return JSON.parse(saved);
  } catch {
    // Use fresh sample records if browser storage is unavailable.
  }
  const organizations = [
    ["cis", "Computer and Information Sciences Council"],
    ["culture", "USC Cultural Council"],
    ["sports", "USC Sports Council"],
    ["student-council", "University Student Council"],
  ].map(([id, name]) => ({
    id,
    name,
    description: "",
    logo_url: "",
    faculty_adviser: "",
    created_by: "demo-admin",
    created_at: new Date().toISOString(),
    archived_at: null,
  }));
  return {
    ...empty,
    organizations,
    memberships: [
      {
        id: "demo-cis-leader",
        organization_id: "cis",
        student_id: "demo-leader",
        role: "leader",
        position: "President",
        term_start: dateIn(-30),
        term_end: dateIn(180),
        revoked_at: null,
      },
      {
        id: "demo-sports-leader",
        organization_id: "sports",
        student_id: "demo-leader",
        role: "leader",
        position: "Activities coordinator",
        term_start: dateIn(-7),
        term_end: dateIn(90),
        revoked_at: null,
      },
      {
        id: "demo-culture-member",
        organization_id: "culture",
        student_id: "demo-leader",
        role: "member",
        position: null,
        term_start: null,
        term_end: null,
        revoked_at: null,
      },
    ],
  };
}
const demoStudents: StudentSummary[] = [
  { id: "demo-leader", full_name: "Sam Villanueva", student_id: "23104999" },
  ...demoPeople.map(({ id, full_name, student_id }) => ({
    id,
    full_name,
    student_id,
  })),
];
async function call(name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase!.rpc(name, args);
  if (error) throw error;
  return data;
}
function createNotice(draft: NoticeDraft): CampusNotification {
  return {
    ...draft,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    read_at: null,
  };
}
function termArguments(term: LeadershipTerm) {
  return {
    p_org: term.organization_id,
    p_student: term.student_id,
    p_position: term.position,
    p_start: term.term_start,
    p_end: term.term_end,
  };
}
interface OrganizationValue extends Directory {
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  leading: Organization[];
  manageable: Organization[];
  organizer: boolean;
  scope: string;
  setScope: (id: string) => void;
  canManage: (id?: string | null) => boolean;
  saveOrganization: (
    id: string | null,
    draft: OrganizationDraft,
  ) => Promise<void>;
  archiveOrganization: (id: string) => Promise<void>;
  findStudents: (id: string, query: string) => Promise<StudentSummary[]>;
  appoint: (term: LeadershipTerm) => Promise<void>;
  revoke: (id: string, student: string) => Promise<void>;
  nominate: (term: LeadershipTerm, explanation: string) => Promise<void>;
  review: (id: string, approve: boolean, reason: string) => Promise<void>;
  markRead: (
    announcements: Announcement[],
    id?: string,
    announcement?: boolean,
  ) => Promise<void>;
  addDemoNotices: (notices: NoticeDraft[]) => void;
}
const Context = createContext<OrganizationValue>(null!);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { profile, demo } = useAuth();
  const notify = useToast();
  const location = useLocation();
  const user = profile?.id ?? "";
  const admin = profile?.role === "admin";
  const [directory, setDirectory] = useState(() =>
    demo ? demoDirectory() : empty,
  );
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [today, setToday] = useState(campusDate);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    const current = ++request.current;
    setError("");
    function rows<T>(table: string, key = "id") {
      return readPages<T>((from, to) =>
        client!.from(table).select("*").order(key).range(from, to),
      );
    }
    try {
      const [
        organizations,
        memberships,
        nominations,
        history,
        leadershipPeople,
        notifications,
        announcementReads,
      ] = await Promise.all([
        rows<Organization>("organizations"),
        user ? rows<Membership>("organization_memberships") : [],
        user ? rows<Nomination>("leadership_nominations") : [],
        admin ? rows<LeadershipHistory>("leadership_history") : [],
        user
          ? readPages<StudentSummary>((from, to) =>
              client.rpc("leadership_people").order("id").range(from, to),
            )
          : [],
        user ? rows<CampusNotification>("notifications") : [],
        user
          ? rows<AnnouncementRead>("announcement_reads", "announcement_id")
          : [],
      ]);
      if (current === request.current) {
        setDirectory({
          organizations,
          memberships,
          nominations,
          history,
          leadershipPeople,
          notifications,
          announcementReads,
        });
        setLoadedFor(user);
      }
    } catch (e) {
      if (current === request.current) {
        setError((e as Error).message);
        setLoadedFor((owner) => (owner === user ? owner : null));
      }
    }
  }, [user, admin]);

  useEffect(() => {
    void refresh();
    const onFocus = () => {
      setToday(campusDate());
      void refresh();
    };
    const clock = window.setInterval(() => setToday(campusDate()), 30_000);
    window.addEventListener("focus", onFocus);
    return () => {
      request.current++;
      window.clearInterval(clock);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, location.key]);
  useEffect(() => {
    if (!demo) return;
    try {
      localStorage.setItem(demoKey, JSON.stringify(directory));
    } catch {
      notify("Browser storage is full. Demo changes may not persist.", true);
    }
  }, [directory, demo, notify]);

  const data = demo || loadedFor === user ? directory : empty;
  const active = data.organizations.filter((org) => !org.archived_at);
  const leading = active.filter((org) =>
    data.memberships.some(
      (m) =>
        m.organization_id === org.id &&
        m.student_id === user &&
        m.role === "leader" &&
        !m.revoked_at &&
        m.term_start &&
        m.term_end &&
        m.term_start <= today &&
        m.term_end >= today,
    ),
  );
  const manageable = admin ? active : leading;
  const scope = admin
    ? data.organizations.some((o) => o.id === selected)
      ? selected
      : ""
    : leading.some((o) => o.id === selected)
      ? selected
      : (leading[0]?.id ?? "");
  const canManage = (id?: string | null) =>
    admin || leading.some((org) => org.id === id);
  const addDemoNotices = (notices: NoticeDraft[]) => {
    if (demo && notices.length)
      setDirectory((state) => ({
        ...state,
        notifications: [...state.notifications, ...notices.map(createNotice)],
      }));
  };
  function orgNotice(
    recipient_id: string,
    organization_id: string,
    type: string,
    title: string,
    message: string,
  ): NoticeDraft {
    return {
      recipient_id,
      organization_id,
      type,
      title,
      message,
      destination: "/organizations/" + organization_id,
    };
  }
  function log(
    state: Directory,
    organization_id: string,
    student_id: string,
    action: string,
    details: Record<string, unknown>,
    nomination_id: string | null = null,
  ) {
    return [
      ...state.history,
      {
        id: crypto.randomUUID(),
        actor_id: user,
        organization_id,
        student_id,
        nomination_id,
        action,
        details,
        created_at: new Date().toISOString(),
      },
    ];
  }
  function validateDemoTerm(term: LeadershipTerm) {
    const org = active.find(
      (candidate) => candidate.id === term.organization_id,
    );
    if (!org) throw Error("Choose an active organization.");
    if (!demoStudents.some((student) => student.id === term.student_id))
      throw Error("Choose a registered student.");
    if (
      term.position.trim().length < 2 ||
      !term.term_start ||
      !term.term_end ||
      term.term_end < term.term_start
    )
      throw Error("Enter a position and valid term dates.");
    return org;
  }
  function existingLeader(term: LeadershipTerm) {
    return directory.memberships.find(
      (m) =>
        m.organization_id === term.organization_id &&
        m.student_id === term.student_id &&
        m.role === "leader" &&
        !m.revoked_at &&
        m.term_end &&
        m.term_end >= today,
    );
  }
  function withAppointment(
    state: Directory,
    term: LeadershipTerm,
    nominationId: string | null = null,
  ) {
    const previous = state.memberships.find(
      (m) =>
        m.organization_id === term.organization_id &&
        m.student_id === term.student_id,
    );
    const appointed: Membership = {
      ...term,
      id: previous?.id ?? crypto.randomUUID(),
      role: "leader",
      revoked_at: null,
    };
    const action =
      previous &&
      !previous.revoked_at &&
      previous.term_end &&
      previous.term_end >= today
        ? "term_changed"
        : "appointed";
    return {
      ...state,
      memberships: [
        ...state.memberships.filter((m) => m.id !== previous?.id),
        appointed,
      ],
      history: log(
        state,
        term.organization_id,
        term.student_id,
        action,
        { previous, appointment: appointed },
        nominationId,
      ),
    };
  }
  async function saveOrganization(id: string | null, draft: OrganizationDraft) {
    if (!admin) throw Error("University admin access required.");
    if (supabase) {
      await call("save_organization", {
        p_org: id,
        p_name: draft.name,
        p_description: draft.description,
        p_logo_url: draft.logo_url,
        p_adviser: draft.faculty_adviser,
      });
      await refresh();
      return;
    }
    if (draft.name.trim().length < 3)
      throw Error("Enter an organization name.");
    if (
      directory.organizations.some(
        (o) =>
          o.id !== id &&
          o.name.toLowerCase() === draft.name.trim().toLowerCase(),
      )
    )
      throw Error("An organization already uses that name.");
    setDirectory((state) => ({
      ...state,
      organizations: id
        ? state.organizations.map((o) => (o.id === id ? { ...o, ...draft } : o))
        : [
            ...state.organizations,
            {
              ...draft,
              id: crypto.randomUUID(),
              created_by: user,
              created_at: new Date().toISOString(),
              archived_at: null,
            },
          ],
    }));
  }
  async function archiveOrganization(id: string) {
    if (!admin) throw Error("University admin access required.");
    if (supabase) {
      await call("archive_organization", { p_org: id });
      await refresh();
      return;
    }
    const org = active.find((o) => o.id === id);
    if (!org) return;
    setDirectory((state) => ({
      ...state,
      organizations: state.organizations.map((o) =>
        o.id === id ? { ...o, archived_at: new Date().toISOString() } : o,
      ),
    }));
    addDemoNotices(
      directory.memberships
        .filter(
          (m) =>
            m.organization_id === id &&
            m.role === "leader" &&
            !m.revoked_at &&
            m.term_end &&
            m.term_end >= today,
        )
        .map((m) =>
          orgNotice(
            m.student_id,
            id,
            "organization_archived",
            "Organization archived",
            org.name +
              " was archived. Its upcoming events were cancelled and leadership access has ended.",
          ),
        ),
    );
  }
  async function findStudents(
    id: string,
    query: string,
  ): Promise<StudentSummary[]> {
    if (!canManage(id)) throw Error("Organization leadership access required.");
    if (supabase)
      return call("find_leadership_students", { p_org: id, p_query: query });
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];
    return demoStudents
      .filter((student) =>
        [student.full_name, student.student_id].some((value) =>
          value?.toLowerCase().includes(term),
        ),
      )
      .slice(0, 20);
  }
  async function appoint(term: LeadershipTerm) {
    if (!admin) throw Error("University admin access required.");
    if (supabase) {
      await call("appoint_leader", termArguments(term));
      await refresh();
      return;
    }
    const org = validateDemoTerm(term);
    const previous = existingLeader(term);
    if (
      previous?.position === term.position &&
      previous.term_start === term.term_start &&
      previous.term_end === term.term_end
    )
      return;
    setDirectory((state) => withAppointment(state, term));
    addDemoNotices([
      orgNotice(
        term.student_id,
        org.id,
        "appointed",
        previous ? "Leadership appointment updated" : "Leadership appointment",
        org.name +
          " appointed you as " +
          term.position +
          " through " +
          term.term_end +
          ".",
      ),
    ]);
  }
  async function revoke(id: string, student: string) {
    if (!admin) throw Error("University admin access required.");
    if (supabase) {
      await call("revoke_leader", { p_org: id, p_student: student });
      await refresh();
      return;
    }
    const m = directory.memberships.find(
      (record) =>
        record.organization_id === id &&
        record.student_id === student &&
        record.role === "leader" &&
        !record.revoked_at,
    );
    if (!m) return;
    setDirectory((state) => ({
      ...state,
      memberships: state.memberships.map((record) =>
        record.id === m.id
          ? { ...record, revoked_at: new Date().toISOString() }
          : record,
      ),
      history: log(state, id, student, "revoked", { membership: m }),
    }));
    addDemoNotices([
      orgNotice(
        student,
        id,
        "revoked",
        "Leadership appointment revoked",
        "Your organization leadership access has ended.",
      ),
    ]);
  }
  async function nominate(term: LeadershipTerm, explanation: string) {
    if (!leading.some((o) => o.id === term.organization_id))
      throw Error("Active organization leadership required.");
    if (supabase) {
      await call("nominate_leader", {
        ...termArguments(term),
        p_explanation: explanation,
      });
      await refresh();
      return;
    }
    const org = validateDemoTerm(term);
    if (term.student_id === user) throw Error("Choose another student.");
    if (term.term_end < today)
      throw Error("The proposed term has already ended.");
    if (explanation.trim().length < 3)
      throw Error("Enter a short explanation.");
    if (existingLeader(term))
      throw Error(
        "This student already holds a current or scheduled appointment.",
      );
    if (
      directory.nominations.some(
        (n) =>
          n.organization_id === org.id &&
          n.nominee_id === term.student_id &&
          n.status === "pending",
      )
    )
      throw Error("A nomination for this student is already pending.");
    const n: Nomination = {
      id: crypto.randomUUID(),
      organization_id: org.id,
      nominee_id: term.student_id,
      nominated_by: user,
      position: term.position,
      term_start: term.term_start,
      term_end: term.term_end,
      explanation,
      status: "pending",
      reason: null,
      created_at: new Date().toISOString(),
    };
    setDirectory((state) => ({
      ...state,
      nominations: [...state.nominations, n],
      history: log(
        state,
        org.id,
        term.student_id,
        "nominated",
        { nomination: n },
        n.id,
      ),
    }));
    addDemoNotices([
      {
        ...orgNotice(
          n.nominee_id,
          org.id,
          "nominated",
          "Leadership nomination pending",
          "You were nominated for " +
            org.name +
            ". University approval is pending.",
        ),
        destination: "/leadership?nomination=" + n.id,
        nomination_id: n.id,
      },
      {
        ...orgNotice(
          "demo-admin",
          org.id,
          "nomination_review",
          "Leadership nomination to review",
          org.name + " has a new nomination.",
        ),
        destination: "/admin/organizations?nomination=" + n.id,
        nomination_id: n.id,
      },
    ]);
  }
  async function review(id: string, approve: boolean, reason: string) {
    if (!admin) throw Error("University admin access required.");
    if (supabase) {
      await call("review_leadership_nomination", {
        p_id: id,
        p_approve: approve,
        p_reason: reason,
      });
      await refresh();
      return;
    }
    const n = directory.nominations.find((record) => record.id === id);
    if (!n || n.status !== "pending")
      throw Error("This nomination has already been reviewed.");
    if (!approve && !reason.trim()) throw Error("Enter a rejection reason.");
    const term: LeadershipTerm = {
      student_id: n.nominee_id,
      organization_id: n.organization_id,
      position: n.position,
      term_start: n.term_start,
      term_end: n.term_end,
    };
    if (approve) {
      validateDemoTerm(term);
      if (n.term_end < today)
        throw Error("The proposed term has already ended.");
      if (existingLeader(term))
        throw Error(
          "This student already holds a current or scheduled appointment.",
        );
    }
    const status = approve ? "approved" : "rejected";
    const reviewed = { ...n, status, reason } as Nomination;
    setDirectory((state) => {
      const next = approve ? withAppointment(state, term, n.id) : state;
      return {
        ...next,
        nominations: next.nominations.map((record) =>
          record.id === id ? reviewed : record,
        ),
        history: log(
          next,
          n.organization_id,
          n.nominee_id,
          status,
          { nomination: reviewed },
          n.id,
        ),
      };
    });
    addDemoNotices(
      [
        ...new Set(
          [n.nominee_id, n.nominated_by].filter(
            (recipient): recipient is string => Boolean(recipient),
          ),
        ),
      ].map((recipient) => ({
        ...orgNotice(
          recipient,
          n.organization_id,
          "nomination_" + status,
          "Leadership nomination " + status,
          "The nomination for " +
            n.position +
            " was " +
            status +
            "." +
            (reason ? " Reason: " + reason : ""),
        ),
        destination: "/leadership?nomination=" + n.id,
        nomination_id: n.id,
      })),
    );
  }
  async function markRead(
    announcements: Announcement[],
    id?: string,
    announcement = false,
  ) {
    if (!user) return;
    if (supabase) {
      await call("mark_notification_read", {
        p_id: id ?? null,
        p_announcement: announcement,
      });
      await refresh();
      return;
    }
    const read_at = new Date().toISOString();
    setDirectory((state) => ({
      ...state,
      notifications: state.notifications.map((n) =>
        n.recipient_id === user &&
        !n.read_at &&
        (!id || (!announcement && n.id === id))
          ? { ...n, read_at }
          : n,
      ),
      announcementReads: [
        ...state.announcementReads,
        ...announcements
          .filter(
            (a) =>
              (!id || (announcement && a.id === id)) &&
              !state.announcementReads.some(
                (r) => r.recipient_id === user && r.announcement_id === a.id,
              ),
          )
          .map((a) => ({ recipient_id: user, announcement_id: a.id, read_at })),
      ],
    }));
  }
  return (
    <Context.Provider
      value={{
        ...data,
        memberships: admin
          ? data.memberships
          : data.memberships.filter((m) => m.student_id === user),
        nominations: admin
          ? data.nominations
          : data.nominations.filter(
              (n) => n.nominee_id === user || n.nominated_by === user,
            ),
        history: admin ? data.history : [],
        leadershipPeople: demo ? demoStudents : data.leadershipPeople,
        notifications: data.notifications.filter(
          (n) => n.recipient_id === user,
        ),
        announcementReads: data.announcementReads.filter(
          (r) => r.recipient_id === user,
        ),
        loading: !demo && loadedFor !== user && !error,
        error,
        refresh,
        leading,
        manageable,
        organizer: admin || leading.length > 0,
        scope,
        setScope: setSelected,
        canManage,
        saveOrganization,
        archiveOrganization,
        findStudents,
        appoint,
        revoke,
        nominate,
        review,
        markRead,
        addDemoNotices,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useOrganizations = () => useContext(Context);
