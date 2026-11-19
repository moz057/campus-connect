import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Building2, Plus, RefreshCw } from "lucide-react";
import { useOrganizations, campusDate } from "../contexts/OrganizationContext";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import {
  Empty,
  ErrorMessage,
  Field,
  Loading,
  PageTitle,
} from "../components/Common";
import type {
  LeadershipTerm,
  Membership,
  Nomination,
  Organization,
  StudentSummary,
} from "../lib/types";
import { dateLabel } from "../lib/utils";

function useAction() {
  const notify = useToast();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>, success: string) {
    setError("");
    setBusy(true);
    try {
      await action();
      if (success) notify(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { error, busy, run };
}

function OrganizationLogo({ organization }: { organization: Organization }) {
  return (
    <span className="organization-logo">
      {organization.logo_url ? (
        <img src={organization.logo_url} alt="" />
      ) : (
        <Building2 size={24} />
      )}
    </span>
  );
}

function JoinOrganization({ organization }: { organization: Organization }) {
  const { profile } = useAuth();
  const { memberships, joinRequests, requestMembership } = useOrganizations();
  const { run, busy, error } = useAction();
  if (organization.archived_at || profile?.role === "admin") return null;
  if (!profile)
    return (
      <Link
        className="button"
        to="/login"
        state={{ from: "/organizations/" + organization.id }}
      >
        Sign in to request membership
      </Link>
    );
  if (
    memberships.some(
      (m) =>
        m.organization_id === organization.id && m.student_id === profile.id,
    )
  )
    return (
      <div className="workflow-actions">
        <span className="success-badge">Member</span>
        <Link to="/leadership" className="text-link">
          View my memberships
        </Link>
      </div>
    );
  const request = joinRequests.find(
    (item) =>
      item.organization_id === organization.id &&
      item.applicant_id === profile.id,
  );
  if (request?.status === "pending")
    return <p role="status">Membership request pending</p>;
  return (
    <div>
      {request?.status === "rejected" && (
        <p>Your last membership request was declined.</p>
      )}
      <ErrorMessage message={error} />
      <button
        type="button"
        className="button primary"
        disabled={busy}
        onClick={() =>
          void run(
            () => requestMembership(organization.id),
            "Membership request sent.",
          )
        }
      >
        {request?.status === "rejected"
          ? "Request to join again"
          : "Request to join"}
      </button>
    </div>
  );
}

function MembershipReview() {
  const { organizations, joinRequests, canManage, reviewMembership } =
    useOrganizations();
  const { run, busy, error } = useAction();
  const pending = joinRequests
    .filter(
      (item) =>
        item.status === "pending" &&
        canManage(item.organization_id) &&
        organizations.some(
          (org) => org.id === item.organization_id && !org.archived_at,
        ),
    )
    .sort((a, b) => a.requested_at.localeCompare(b.requested_at));

  return (
    <section
      className="panel organization-card"
      aria-labelledby="membership-review"
    >
      <h2 id="membership-review">Membership requests</h2>
      <ErrorMessage message={error} />
      {pending.length === 0 && <p>No pending membership requests.</p>}
      {pending.map((item) => (
        <article className="panel organization-card" key={item.id}>
          <h3>{item.applicant_name || "Student"}</h3>
          {item.applicant_student_id && (
            <p>Student ID {item.applicant_student_id}</p>
          )}
          <p>
            {organizations.find((org) => org.id === item.organization_id)?.name}
          </p>
          <p>Requested {dateLabel(item.requested_at)}</p>
          <div className="workflow-actions">
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() =>
                void run(
                  () => reviewMembership(item.id, true),
                  "Membership approved.",
                )
              }
            >
              Approve membership
            </button>
            <button
              type="button"
              className="button subtle"
              disabled={busy}
              onClick={() =>
                void run(
                  () => reviewMembership(item.id, false),
                  "Membership request declined.",
                )
              }
            >
              Decline request
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

export function OrganizationDirectory() {
  const { id } = useParams();
  const { organizations, loading, error } = useOrganizations();
  const { events } = useData();
  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (id) {
    const organization = organizations.find((org) => org.id === id);
    if (!organization) return <Empty title="Organization not found" />;
    const upcoming = events.filter(
      (event) =>
        event.organization_id === id &&
        !event.cancelled_at &&
        Date.parse(event.end_time) > Date.now(),
    );
    return (
      <>
        <Link to="/organizations" className="back-link">
          ← All organizations
        </Link>
        <PageTitle
          title={organization.name}
          description={
            organization.archived_at
              ? "Archived organization"
              : "Recognized student organization"
          }
        />
        <section className="panel organization-card">
          <OrganizationLogo organization={organization} />
          {organization.description && (
            <p className="preserve-lines">{organization.description}</p>
          )}
          {organization.faculty_adviser && (
            <p>
              Faculty adviser <strong>{organization.faculty_adviser}</strong>
            </p>
          )}
          {organization.archived_at && (
            <p>
              Upcoming events were cancelled. Past registrations and attendance
              remain available.
            </p>
          )}
          <JoinOrganization key={organization.id} organization={organization} />
        </section>
        {upcoming.length > 0 && (
          <section className="panel organization-card">
            <h2>Upcoming events</h2>
            <ul>
              {upcoming.map((event) => (
                <li key={event.id}>
                  <Link to={"/events/" + event.id}>{event.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    );
  }
  const active = organizations
    .filter((org) => !org.archived_at)
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <PageTitle
        title="Student organizations"
        description="Explore recognized University of San Carlos organizations."
      />
      {active.length ? (
        <div className="organization-grid">
          {active.map((organization) => (
            <article className="panel organization-card" key={organization.id}>
              <OrganizationLogo organization={organization} />
              <h2>
                <Link to={"/organizations/" + organization.id}>
                  {organization.name}
                </Link>
              </h2>
              {organization.description && <p>{organization.description}</p>}
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No recognized organizations yet" />
      )}
    </>
  );
}

function StudentLookup({
  organization,
  selected,
  onSelect,
}: {
  organization: string;
  selected: StudentSummary | null;
  onSelect: (student: StudentSummary | null) => void;
}) {
  const { findStudents } = useOrganizations();
  const { busy, error, run } = useAction();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<StudentSummary[] | null>(null);
  function search() {
    if (!busy && query.trim().length >= 2)
      void run(
        async () => setMatches(await findStudents(organization, query)),
        "",
      );
  }
  return (
    <div className="student-lookup">
      <Field label="Find a registered student">
        <input
          value={query}
          placeholder="Name or student ID"
          onChange={(event) => {
            setQuery(event.target.value);
            setMatches(null);
            onSelect(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              search();
            }
          }}
        />
      </Field>
      <button
        type="button"
        className="button small-button"
        disabled={busy || query.trim().length < 2}
        onClick={search}
      >
        {busy ? "Searching…" : "Search students"}
      </button>
      <ErrorMessage message={error} />
      {matches?.length === 0 && <p role="status">No matching students.</p>}
      {matches && matches.length > 0 && (
        <Field label="Student">
          <select
            required
            value={selected?.id ?? ""}
            onChange={(event) =>
              onSelect(
                matches.find((student) => student.id === event.target.value) ??
                  null,
              )
            }
          >
            <option value="">Choose a student</option>
            {matches.map((student) => (
              <option key={student.id} value={student.id}>
                {student.full_name || "Student"}
                {student.student_id ? " · " + student.student_id : ""}
              </option>
            ))}
          </select>
        </Field>
      )}
    </div>
  );
}
function TermForm({
  organization,
  edit,
  nomination = false,
  onSave,
}: {
  organization: string;
  edit?: Membership;
  nomination?: boolean;
  onSave: (term: LeadershipTerm, explanation: string) => Promise<void>;
}) {
  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [position, setPosition] = useState(edit?.position ?? "");
  const [start, setStart] = useState(edit?.term_start ?? campusDate());
  const [end, setEnd] = useState(edit?.term_end ?? "");
  const [explanation, setExplanation] = useState("");
  const { run, busy, error } = useAction();
  const studentId = edit?.student_id ?? student?.id;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!studentId) return;
    await run(
      async () => {
        await onSave(
          {
            organization_id: organization,
            student_id: studentId,
            position: position.trim(),
            term_start: start,
            term_end: end,
          },
          explanation.trim(),
        );
        if (!edit) {
          setStudent(null);
          setPosition("");
          setEnd("");
          setExplanation("");
        }
      },
      nomination
        ? "Nomination submitted for approval."
        : "Leadership appointment saved.",
    );
  }
  return (
    <form className="workflow-form" onSubmit={submit}>
      <ErrorMessage message={error} />
      {!edit && (
        <StudentLookup
          organization={organization}
          selected={student}
          onSelect={setStudent}
        />
      )}
      <div className="form-grid">
        <Field label="Position">
          <input
            required
            minLength={2}
            maxLength={120}
            value={position}
            onChange={(event) => setPosition(event.target.value)}
          />
        </Field>
        <Field label="Term start">
          <input
            type="date"
            required
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </Field>
        <Field label="Term end">
          <input
            type="date"
            min={start || undefined}
            required
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </Field>
      </div>
      {nomination && (
        <Field label="Why are you nominating this student?">
          <textarea
            required
            minLength={3}
            maxLength={1000}
            rows={3}
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
          />
        </Field>
      )}
      <button className="button primary" disabled={busy || !studentId}>
        {busy
          ? "Saving…"
          : nomination
            ? "Submit nomination"
            : edit
              ? "Save appointment"
              : "Appoint student"}
      </button>
    </form>
  );
}
function OrganizationEditor({
  organization,
  onSaved,
}: {
  organization?: Organization;
  onSaved: () => void;
}) {
  const { saveOrganization } = useOrganizations();
  const [name, setName] = useState(organization?.name ?? "");
  const [description, setDescription] = useState(
    organization?.description ?? "",
  );
  const [logo, setLogo] = useState(organization?.logo_url ?? "");
  const [adviser, setAdviser] = useState(organization?.faculty_adviser ?? "");
  const { run, busy, error } = useAction();
  return (
    <form
      className="panel organization-card workflow-form"
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          await saveOrganization(organization?.id ?? null, {
            name: name.trim(),
            description: description.trim(),
            logo_url: logo.trim(),
            faculty_adviser: adviser.trim(),
          });
          onSaved();
        }, "Organization saved.");
      }}
    >
      <h2>{organization ? "Edit organization" : "Create organization"}</h2>
      <ErrorMessage message={error} />
      <div className="form-grid">
        <Field label="Organization name">
          <input
            required
            minLength={3}
            maxLength={160}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Faculty adviser">
          <input
            maxLength={160}
            value={adviser}
            onChange={(event) => setAdviser(event.target.value)}
          />
        </Field>
        <Field label="Logo URL">
          <input
            type="url"
            value={logo}
            onChange={(event) => setLogo(event.target.value)}
          />
        </Field>
        <div className="span-two">
          <Field label="Description">
            <textarea
              maxLength={5000}
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
        </div>
      </div>
      <button className="button primary" disabled={busy}>
        {busy ? "Saving…" : "Save organization"}
      </button>
    </form>
  );
}

function NominationCard({
  nomination,
  reviewable = false,
}: {
  nomination: Nomination;
  reviewable?: boolean;
}) {
  const { organizations, leadershipPeople, review } = useOrganizations();
  const { run, busy, error } = useAction();
  const [reason, setReason] = useState("");
  const name = (id: string | null) =>
    leadershipPeople.find((person) => person.id === id)?.full_name || "Student";
  return (
    <article
      className="panel organization-card"
      id={"nomination-" + nomination.id}
    >
      <span
        className={
          nomination.status === "pending"
            ? "waitlist-badge"
            : nomination.status === "approved"
              ? "success-badge"
              : "workflow-rejected"
        }
      >
        {nomination.status}
      </span>
      <h2>{nomination.position}</h2>
      <p>
        {
          organizations.find((org) => org.id === nomination.organization_id)
            ?.name
        }{" "}
        · {nomination.term_start} through {nomination.term_end}
      </p>
      <p>
        Nominee <strong>{name(nomination.nominee_id)}</strong> · Nominated by{" "}
        <strong>{name(nomination.nominated_by)}</strong>
      </p>
      <p className="preserve-lines">{nomination.explanation}</p>
      {nomination.reason && (
        <p className="preserve-lines">Decision reason: {nomination.reason}</p>
      )}
      {reviewable && nomination.status === "pending" && (
        <>
          <ErrorMessage message={error} />
          <Field label="Decision reason" hint="Required for rejection.">
            <textarea
              maxLength={1000}
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <div className="button-row">
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() =>
                void run(
                  () => review(nomination.id, true, reason),
                  "Nomination approved.",
                )
              }
            >
              Approve
            </button>
            <button
              type="button"
              className="button danger-link"
              disabled={busy || !reason.trim()}
              onClick={() =>
                void run(
                  () => review(nomination.id, false, reason),
                  "Nomination rejected.",
                )
              }
            >
              Reject
            </button>
          </div>
        </>
      )}
    </article>
  );
}

function NominationList({ reviewable = false }: { reviewable?: boolean }) {
  const { nominations } = useOrganizations();
  const [params] = useSearchParams();
  const emphasized = params.get("nomination");
  const visible = [...nominations].sort(
    (a, b) =>
      Number(b.id === emphasized) - Number(a.id === emphasized) ||
      Number(b.status === "pending") - Number(a.status === "pending") ||
      b.created_at.localeCompare(a.created_at),
  );
  return visible.length ? (
    <div className="organization-grid">
      {visible.map((nomination) => (
        <NominationCard
          key={nomination.id}
          nomination={nomination}
          reviewable={reviewable}
        />
      ))}
    </div>
  ) : (
    <Empty title="No leadership nominations yet" />
  );
}

function AppointmentCard({
  membership,
  organization,
}: {
  membership: Membership;
  organization: Organization;
}) {
  const { appoint, revoke, leadershipPeople } = useOrganizations();
  const { error, busy, run } = useAction();
  const [editing, setEditing] = useState(false);
  const today = campusDate();
  const status = organization.archived_at
    ? "Archived"
    : membership.revoked_at
      ? "Revoked"
      : membership.term_start && membership.term_start > today
        ? "Scheduled"
        : membership.term_end && membership.term_end < today
          ? "Expired"
          : "Active";
  return (
    <article className="panel organization-card">
      <h3>
        {leadershipPeople.find(
          (student) => student.id === membership.student_id,
        )?.full_name || "Student"}
      </h3>
      <p>
        {membership.position} · {status}
      </p>
      <p>
        {membership.term_start} through {membership.term_end}
      </p>
      <ErrorMessage message={error} />
      {!organization.archived_at && (
        <div className="button-row">
          <button
            type="button"
            className="button"
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Close editor" : "Edit appointment"}
          </button>
          {!membership.revoked_at && (
            <button
              type="button"
              className="button danger-link"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Revoke leadership for this organization?"))
                  void run(
                    () => revoke(organization.id, membership.student_id),
                    "Leadership revoked.",
                  );
              }}
            >
              Revoke
            </button>
          )}
        </div>
      )}
      {editing && !organization.archived_at && (
        <TermForm
          edit={membership}
          organization={organization.id}
          onSave={async (term) => {
            await appoint(term);
            setEditing(false);
          }}
        />
      )}
    </article>
  );
}

export function OrganizationAdmin() {
  const {
    organizations,
    memberships,
    history,
    leadershipPeople,
    loading,
    error,
    refresh,
    appoint,
  } = useOrganizations();
  const { archiveOrganization } = useData();
  const [params, setParams] = useSearchParams();
  const tab =
    params.get("tab") ??
    (params.has("nomination") ? "nominations" : "organizations");
  const [selected, setSelected] = useState("");
  const [mode, setMode] = useState<"create" | "edit" | "view">("view");
  const adminAction = useAction();
  const organization = organizations.find((item) => item.id === selected);
  const name = (id: string | null) =>
    leadershipPeople.find((student) => student.id === id)?.full_name || "—";
  return (
    <>
      <PageTitle
        title="Manage organizations"
        description="Maintain recognized organizations and oversee student leadership."
        action={
          <button className="button" onClick={() => void refresh()}>
            <RefreshCw size={16} /> Refresh
          </button>
        }
      />
      <ErrorMessage message={error || adminAction.error} />
      <div className="page-tabs">
        {[
          ["organizations", "Organizations"],
          ["memberships", "Membership requests"],
          ["nominations", "Nomination review"],
          ["history", "Leadership history"],
        ].map(([id, title]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "active" : ""}
            aria-pressed={tab === id}
            onClick={() => setParams({ tab: id })}
          >
            {title}
          </button>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : tab === "memberships" ? (
        <MembershipReview />
      ) : tab === "nominations" ? (
        <NominationList reviewable />
      ) : tab === "history" ? (
        history.length ? (
          <div className="organization-grid">
            {[...history]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .map((record) => (
                <article key={record.id} className="panel organization-card">
                  <h2>{record.action.replaceAll("_", " ")}</h2>
                  <p>
                    {
                      organizations.find(
                        (org) => org.id === record.organization_id,
                      )?.name
                    }
                  </p>
                  <p>
                    {name(record.student_id)} · by {name(record.actor_id)}
                  </p>
                  <p>
                    {dateLabel(record.created_at, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  <details>
                    <summary>Audit details</summary>
                    <pre className="workflow-audit">
                      {JSON.stringify(record.details, null, 2)}
                    </pre>
                  </details>
                </article>
              ))}
          </div>
        ) : (
          <Empty title="No leadership history yet" />
        )
      ) : (
        <>
          <div className="workflow-toolbar">
            <Field label="Organization">
              <select
                value={selected}
                onChange={(event) => {
                  setSelected(event.target.value);
                  setMode("view");
                }}
              >
                <option value="">Choose an organization</option>
                {[...organizations]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                      {org.archived_at ? " (archived)" : ""}
                    </option>
                  ))}
              </select>
            </Field>
            <button
              type="button"
              className="button primary"
              onClick={() => setMode("create")}
            >
              <Plus size={16} /> Create organization
            </button>
          </div>
          {mode === "create" && (
            <OrganizationEditor key="create" onSaved={() => setMode("view")} />
          )}
          {organization && mode !== "create" && (
            <>
              {mode === "edit" ? (
                <OrganizationEditor
                  key={organization.id}
                  organization={organization}
                  onSaved={() => setMode("view")}
                />
              ) : (
                <section className="panel organization-card">
                  <OrganizationLogo organization={organization} />
                  <h2>{organization.name}</h2>
                  <p>
                    {organization.archived_at ? "Archived" : "Active"} · Created{" "}
                    {dateLabel(organization.created_at, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  {organization.description && (
                    <p>{organization.description}</p>
                  )}
                  <div className="button-row">
                    <button
                      type="button"
                      className="button"
                      onClick={() => setMode("edit")}
                    >
                      Edit organization
                    </button>
                    {!organization.archived_at && (
                      <button
                        type="button"
                        className="button danger-link"
                        disabled={adminAction.busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Archive this organization? Upcoming events will be cancelled, leadership access will end, and historical records will be retained.",
                            )
                          )
                            void adminAction.run(
                              () => archiveOrganization(organization.id),
                              "Organization archived.",
                            );
                        }}
                      >
                        Archive organization
                      </button>
                    )}
                  </div>
                </section>
              )}
              {!organization.archived_at && (
                <section className="panel organization-card">
                  <h2>Direct appointment</h2>
                  <p>Terms use Philippine dates and include the last day.</p>
                  <TermForm
                    key={organization.id}
                    organization={organization.id}
                    onSave={appoint}
                  />
                </section>
              )}
              <h2 className="workflow-heading">Leadership appointments</h2>
              <div className="organization-grid">
                {memberships
                  .filter(
                    (m) =>
                      m.organization_id === organization.id &&
                      m.role === "leader",
                  )
                  .map((m) => (
                    <AppointmentCard
                      key={
                        m.id +
                        (m.term_end ?? "") +
                        (m.term_start ?? "") +
                        (m.position ?? "")
                      }
                      membership={m}
                      organization={organization}
                    />
                  ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

export function Leadership() {
  const { profile } = useAuth();
  const {
    organizations,
    leading,
    memberships,
    loading,
    error,
    nominate,
    scope,
  } = useOrganizations();
  const [selected, setSelected] = useState("");
  const organization =
    leading.find((org) => org.id === selected) ??
    leading.find((org) => org.id === scope) ??
    leading[0];
  if (loading) return <Loading />;
  return (
    <>
      <PageTitle
        title="Leadership"
        description="View your memberships, appointments, and nomination decisions."
      />
      <ErrorMessage message={error} />
      {memberships.some((m) => m.student_id === profile?.id) && (
        <div className="organization-grid">
          {memberships
            .filter((m) => m.student_id === profile?.id)
            .map((m) => (
              <article key={m.id} className="panel organization-card">
                <h2>
                  <Link to={"/organizations/" + m.organization_id}>
                    {
                      organizations.find((org) => org.id === m.organization_id)
                        ?.name
                    }
                  </Link>
                </h2>
                <p>
                  {m.position ?? "Member"}
                  {m.role === "leader" &&
                    (m.revoked_at
                      ? " · Revoked"
                      : leading.some((org) => org.id === m.organization_id)
                        ? " · Active"
                        : " · Inactive")}
                </p>
                {m.term_start && (
                  <p>
                    {m.term_start} through {m.term_end}
                  </p>
                )}
              </article>
            ))}
        </div>
      )}
      {organization && (
        <section className="panel organization-card">
          <h2>Nominate a student leader</h2>
          <Field label="Nomination organization">
            <select
              value={organization.id}
              onChange={(event) => setSelected(event.target.value)}
            >
              {leading.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </Field>
          <TermForm
            key={organization.id}
            organization={organization.id}
            nomination
            onSave={nominate}
          />
        </section>
      )}
      {leading.length > 0 && <MembershipReview />}
      <h2 className="workflow-heading">Nominations</h2>
      <NominationList />
    </>
  );
}
